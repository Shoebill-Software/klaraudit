import geoipLite from 'geoip-lite';
import {
  type Browser,
  type Cookie,
  type Page,
  type Response as PlaywrightResponse,
} from 'playwright-core';
import { launchChromium } from './chromium.js';
import type { CapturedCookie, CapturedRequest, ScanContext } from '../types/index.js';

export type { CapturedCookie, CapturedRequest, ScanContext } from '../types/index.js';
export { CHROMIUM_LAUNCH_ARGS, launchChromium } from './chromium.js';

/** EU member states + EEA (IS, LI, NO). Anything else is treated as non-EU for Schrems heuristics. */
const EU_EEA_COUNTRY_CODES = new Set<string>([
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  'IS',
  'LI',
  'NO',
]);

const CMP_BANNER_SELECTOR =
  '[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"]';

const LEGAL_PATHS = {
  impressum: ['/impressum', '/imprint'] as const,
  datenschutz: ['/datenschutz', '/privacy'] as const,
} as const;

const LEGAL_PAGE_TIMEOUT_MS = 10_000;
const DEFERRED_SCRIPT_WAIT_MS = 3_000;

interface BannerProbeResult {
  bannerFound: boolean;
  hasRejectButton: boolean;
}

interface LegalPageResult {
  found: boolean;
  status: number;
  url?: string;
}

/**
 * Headless pre-consent capture: network artifacts, cookies, CMP heuristics,
 * and mandatory legal-page reachability. All GeoIP resolution is local.
 */
export async function scanPage(
  targetUrl: string,
  timeoutMs = 15_000,
): Promise<ScanContext> {
  assertHttpUrl(targetUrl);

  const startTime = new Date();
  const requests: CapturedRequest[] = [];
  const responseJobs: Promise<void>[] = [];

  let browser: Browser | undefined;

  try {
    browser = await launchChromium();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    page.on('response', (response: PlaywrightResponse) => {
      responseJobs.push(captureResponse(response, requests));
    });

    try {
      await page.goto(targetUrl, { waitUntil: 'load', timeout: timeoutMs });
    } catch {
      // Defensive: pages may hang or block bots; still harvest whatever loaded.
    }

    try {
      await page.waitForTimeout(DEFERRED_SCRIPT_WAIT_MS);
    } catch {
      // Page may already be closed or navigated away.
    }

    await Promise.all(responseJobs);

    const cookies = await captureCookies(context.cookies.bind(context));
    const banner = await probeConsentBanner(page);
    const mandatoryPages = await checkMandatoryLegalPages(targetUrl);

    return {
      targetUrl,
      startTime,
      endTime: new Date(),
      requests,
      cookies,
      bannerFound: banner.bannerFound,
      hasRejectButton: banner.hasRejectButton,
      mandatoryPages,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function assertHttpUrl(targetUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid URL: ${targetUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Unsupported URL protocol "${parsed.protocol}". Expected http: or https:`,
    );
  }
}

async function captureResponse(
  response: PlaywrightResponse,
  sink: CapturedRequest[],
): Promise<void> {
  try {
    const url = response.url();
    if (!isHttpUrl(url)) {
      return;
    }

    const domain = extractDomain(url);
    const status = response.status();
    const method = response.request().method();

    let ip: string | undefined;
    let country: string | undefined;
    let isNonEU = false;

    try {
      const serverAddr = await response.serverAddr();
      if (serverAddr?.ipAddress) {
        ip = serverAddr.ipAddress;
        const geo = geoipLite.lookup(ip);
        if (geo?.country && geo.country.length > 0) {
          country = geo.country;
          isNonEU = !EU_EEA_COUNTRY_CODES.has(country.toUpperCase());
        }
      }
    } catch {
      // serverAddr is unavailable for some response types; keep request without GeoIP.
    }

    const captured: CapturedRequest = {
      url,
      domain,
      method,
      status,
      isNonEU,
    };
    if (ip !== undefined) {
      captured.ip = ip;
    }
    if (country !== undefined) {
      captured.country = country;
    }

    sink.push(captured);
  } catch {
    // Isolate per-response failures so one bad frame cannot abort the scan.
  }
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return '';
  }
}

async function captureCookies(
  readCookies: () => Promise<Cookie[]>,
): Promise<CapturedCookie[]> {
  try {
    const cookies = await readCookies();
    return cookies.map(toCapturedCookie);
  } catch {
    return [];
  }
}

function toCapturedCookie(cookie: Cookie): CapturedCookie {
  const sameSite =
    cookie.sameSite === 'Strict' ||
    cookie.sameSite === 'Lax' ||
    cookie.sameSite === 'None'
      ? cookie.sameSite
      : 'Lax';

  return {
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite,
  };
}

async function probeConsentBanner(page: Page): Promise<BannerProbeResult> {
  try {
    // Browser-side callback: avoid relying on the DOM lib in the Node TS project.
    return await page.evaluate((bannerSelector: string): BannerProbeResult => {
      const doc = (
        globalThis as unknown as {
          document: {
            querySelectorAll: (selector: string) => Iterable<{
              querySelectorAll: (selector: string) => Iterable<{
                textContent: string | null;
                getAttribute: (name: string) => string | null;
              }>;
            }>;
          };
        }
      ).document;

      const banners = Array.from(doc.querySelectorAll(bannerSelector));
      const bannerFound = banners.length > 0;
      const roots = bannerFound ? banners : [];
      const rejectPattern = /\b(reject|ablehnen)\b/i;

      let hasRejectButton = false;
      for (const root of roots) {
        const controls = root.querySelectorAll(
          'button, a, [role="button"], input[type="button"], input[type="submit"]',
        );
        for (const control of controls) {
          const label = [
            control.textContent ?? '',
            control.getAttribute('aria-label') ?? '',
            control.getAttribute('title') ?? '',
            control.getAttribute('value') ?? '',
          ].join(' ');
          if (rejectPattern.test(label)) {
            hasRejectButton = true;
            break;
          }
        }
        if (hasRejectButton) {
          break;
        }
      }

      return { bannerFound, hasRejectButton };
    }, CMP_BANNER_SELECTOR);
  } catch {
    return { bannerFound: false, hasRejectButton: false };
  }
}

async function checkMandatoryLegalPages(
  targetUrl: string,
): Promise<ScanContext['mandatoryPages']> {
  let origin: string;
  try {
    origin = new URL(targetUrl).origin;
  } catch {
    return {
      impressum: { found: false, status: 0 },
      datenschutz: { found: false, status: 0 },
    };
  }

  const [impressum, datenschutz] = await Promise.all([
    resolveLegalPage(origin, LEGAL_PATHS.impressum),
    resolveLegalPage(origin, LEGAL_PATHS.datenschutz),
  ]);

  return { impressum, datenschutz };
}

async function resolveLegalPage(
  origin: string,
  paths: readonly string[],
): Promise<LegalPageResult> {
  let lastStatus = 0;

  for (const path of paths) {
    const url = `${origin}${path}`;
    const status = await fetchPageStatus(url);
    if (status !== null) {
      lastStatus = status;
    }
    if (status === 200) {
      return { found: true, status, url };
    }
  }

  return { found: false, status: lastStatus };
}

async function fetchPageStatus(url: string): Promise<number | null> {
  const headStatus = await fetchStatus(url, 'HEAD');
  if (headStatus === 200) {
    return headStatus;
  }

  // Some hosts disallow HEAD; fall back to GET.
  return fetchStatus(url, 'GET');
}

async function fetchStatus(
  url: string,
  method: 'HEAD' | 'GET',
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, LEGAL_PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'KlarAudit/0.1 (+local; EU compliance scanner)',
      },
    });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
