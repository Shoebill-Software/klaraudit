import geoipLite from 'geoip-lite';
import { chromium, type Browser, type BrowserContext, type Cookie, type Page } from 'playwright-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lookup } from 'geoip-lite';
import { CHROMIUM_LAUNCH_ARGS, scanPage } from './scanner.js';

vi.mock('playwright-core', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

vi.mock('geoip-lite', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

interface MockResponse {
  url: () => string;
  status: () => number;
  request: () => { method: () => string };
  serverAddr: () => Promise<{ ipAddress: string; port: number } | null>;
}

function createGeoLookup(country = 'US'): Lookup {
  return {
    range: [0, 1],
    country,
    region: 'CA',
    eu: country === 'US' ? '0' : '1',
    timezone: 'America/Los_Angeles',
    city: 'Mountain View',
    ll: [37.386, -122.0838],
    metro: 807,
    area: 1000,
  };
}

function createMockPage(responsesOnGoto: MockResponse[]): {
  page: Page;
  responseListenerAttachedBeforeGoto: () => boolean;
} {
  const responseListeners: Array<(response: MockResponse) => void> = [];
  let gotoCalled = false;
  let responseHookedBeforeGoto = false;

  const page = {
    on: vi.fn((event: string, handler: (response: MockResponse) => void) => {
      if (event === 'response') {
        if (!gotoCalled) {
          responseHookedBeforeGoto = true;
        }
        responseListeners.push(handler);
      }
    }),
    goto: vi.fn(async () => {
      gotoCalled = true;
      for (const listener of responseListeners) {
        for (const response of responsesOnGoto) {
          listener(response);
        }
      }
      return null;
    }),
    waitForTimeout: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => ({
      bannerFound: true,
      hasRejectButton: false,
    })),
    setDefaultTimeout: vi.fn(),
    setDefaultNavigationTimeout: vi.fn(),
  };

  return {
    page: page as unknown as Page,
    responseListenerAttachedBeforeGoto: () => responseHookedBeforeGoto,
  };
}

function createMockBrowser(page: Page, cookies: Cookie[]): Browser {
  const context = {
    newPage: vi.fn(async () => page),
    cookies: vi.fn(async () => cookies),
  };

  return {
    newContext: vi.fn(async () => context as unknown as BrowserContext),
    close: vi.fn(async () => undefined),
  } as unknown as Browser;
}

describe('scanPage', () => {
  const targetUrl = 'https://example.com/';
  const trackingResponse: MockResponse = {
    url: () => 'https://www.google-analytics.com/g/collect',
    status: () => 200,
    request: () => ({ method: () => 'GET' }),
    serverAddr: async () => ({ ipAddress: '142.250.185.142', port: 443 }),
  };
  const documentResponse: MockResponse = {
    url: () => targetUrl,
    status: () => 200,
    request: () => ({ method: () => 'GET' }),
    serverAddr: async () => ({ ipAddress: '93.184.216.34', port: 443 }),
  };
  const preConsentCookie: Cookie = {
    name: '_ga',
    value: 'GA1.1.123',
    domain: '.example.com',
    path: '/',
    expires: Date.now() / 1000 + 86_400,
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(geoipLite.lookup).mockImplementation((ip: string) => {
      if (ip === '142.250.185.142') {
        return createGeoLookup('US');
      }
      return createGeoLookup('DE');
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/impressum') || url.includes('/datenschutz')) {
          return { status: 200 } as Response;
        }
        return { status: 404 } as Response;
      }),
    );
  });

  it('collects pre-consent network artifacts, cookies, GeoIP, and legal pages', async () => {
    const { page, responseListenerAttachedBeforeGoto } = createMockPage([
      documentResponse,
      trackingResponse,
    ]);
    const browser = createMockBrowser(page, [preConsentCookie]);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await scanPage(targetUrl, 5_000);

    expect(chromium.launch).toHaveBeenCalledWith({
      headless: true,
      args: [...CHROMIUM_LAUNCH_ARGS],
    });
    expect(CHROMIUM_LAUNCH_ARGS).toEqual([
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]);
    expect(responseListenerAttachedBeforeGoto()).toBe(true);
    expect(page.goto).toHaveBeenCalledWith(targetUrl, {
      waitUntil: 'load',
      timeout: 5_000,
    });
    expect(page.waitForTimeout).toHaveBeenCalledWith(3_000);
    expect(browser.close).toHaveBeenCalledOnce();

    expect(result.targetUrl).toBe(targetUrl);
    expect(result.bannerFound).toBe(true);
    expect(result.hasRejectButton).toBe(false);
    expect(result.mandatoryPages.impressum.found).toBe(true);
    expect(result.mandatoryPages.datenschutz.found).toBe(true);
    expect(result.endTime).toBeInstanceOf(Date);

    expect(result.cookies).toEqual([
      {
        name: '_ga',
        domain: '.example.com',
        path: '/',
        expires: preConsentCookie.expires,
        httpOnly: false,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    expect(result.requests).toHaveLength(2);
    const analytics = result.requests.find(
      (request) => request.domain === 'www.google-analytics.com',
    );
    expect(analytics).toMatchObject({
      url: 'https://www.google-analytics.com/g/collect',
      domain: 'www.google-analytics.com',
      method: 'GET',
      status: 200,
      ip: '142.250.185.142',
      country: 'US',
      isNonEU: true,
    });

    const document = result.requests.find((request) => request.domain === 'example.com');
    expect(document).toMatchObject({
      country: 'DE',
      isNonEU: false,
    });
  });

  it('falls back to system Chrome when the local Chromium binary is missing', async () => {
    const { page } = createMockPage([documentResponse]);
    const browser = createMockBrowser(page, []);
    vi.mocked(chromium.launch)
      .mockRejectedValueOnce(new Error('Executable does not exist'))
      .mockResolvedValueOnce(browser);

    const result = await scanPage(targetUrl, 5_000);

    expect(chromium.launch).toHaveBeenNthCalledWith(1, {
      headless: true,
      args: [...CHROMIUM_LAUNCH_ARGS],
    });
    expect(chromium.launch).toHaveBeenNthCalledWith(2, {
      headless: true,
      channel: 'chrome',
      args: [...CHROMIUM_LAUNCH_ARGS],
    });
    expect(result.requests).toHaveLength(1);
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('still closes the browser and returns a ScanContext when navigation times out', async () => {
    const { page } = createMockPage([]);
    vi.mocked(page.goto).mockRejectedValue(new Error('Timeout 5000ms exceeded'));
    const browser = createMockBrowser(page, []);
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const result = await scanPage(targetUrl, 5_000);

    expect(result.requests).toEqual([]);
    expect(result.cookies).toEqual([]);
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
