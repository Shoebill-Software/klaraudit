import type {
  CapturedCookie,
  CapturedRequest,
  ComplianceRule,
  ScanContext,
  Violation,
} from '../types/index.js';

interface TrackerVendor {
  host: string;
  label: string;
  fix: string;
}

/**
 * Known tracking / analytics hosts that must not fire before consent
 * (e-Privacy Directive / GDPR Art. 5(3)).
 */
const TRACKING_VENDORS: readonly TrackerVendor[] = [
  {
    host: 'googletagmanager.com',
    label: 'Google Tag Manager',
    fix: 'Load GTM only after opt-in (Consent Mode / CMP gate), or remove it from the first paint.',
  },
  {
    host: 'google-analytics.com',
    label: 'Google Analytics',
    fix: 'Block gtag/analytics.js until the visitor accepts analytics cookies.',
  },
  {
    host: 'doubleclick.net',
    label: 'Google DoubleClick / Ads',
    fix: 'Do not load ad or remarketing pixels until advertising consent is granted.',
  },
  {
    host: 'facebook.net',
    label: 'Meta Pixel',
    fix: 'Load the Meta (Facebook) Pixel only after marketing consent.',
  },
  {
    host: 'connect.facebook.net',
    label: 'Meta Pixel',
    fix: 'Load the Meta (Facebook) Pixel only after marketing consent.',
  },
  {
    host: 'hotjar.com',
    label: 'Hotjar',
    fix: 'Defer Hotjar until analytics/session-recording consent is given.',
  },
  {
    host: 'tiktok.com',
    label: 'TikTok Pixel',
    fix: 'Load the TikTok Pixel only after marketing consent.',
  },
  {
    host: 'clarity.ms',
    label: 'Microsoft Clarity',
    fix: 'Defer Clarity until analytics consent is given.',
  },
  {
    host: 'criteo.com',
    label: 'Criteo',
    fix: 'Do not load Criteo until advertising consent is granted.',
  },
] as const;

interface TrackingCookieHint {
  pattern: RegExp;
  label: string;
  fix: string;
}

/** Non-essential tracking cookies commonly set prior to consent. */
const TRACKING_COOKIES: readonly TrackingCookieHint[] = [
  {
    pattern: /^_ga$/i,
    label: 'Google Analytics (_ga)',
    fix: 'Stop setting _ga until analytics consent; use a CMP or Consent Mode that gates storage.',
  },
  {
    pattern: /^_gid$/i,
    label: 'Google Analytics (_gid)',
    fix: 'Stop setting _gid until analytics consent.',
  },
  {
    pattern: /^_fbp$/i,
    label: 'Meta Pixel (_fbp)',
    fix: 'Stop setting _fbp until marketing consent.',
  },
  {
    pattern: /^_clck$/i,
    label: 'Microsoft Clarity (_clck)',
    fix: 'Stop setting Clarity cookies until analytics consent.',
  },
  {
    pattern: /^_hjSession/i,
    label: 'Hotjar session cookie',
    fix: 'Stop setting Hotjar session cookies until analytics consent.',
  },
];

function matchVendor(domain: string): TrackerVendor | undefined {
  const lowered = domain.toLowerCase();
  return TRACKING_VENDORS.find(
    (vendor) => lowered === vendor.host || lowered.endsWith(`.${vendor.host}`),
  );
}

function matchTrackingCookie(cookie: CapturedCookie): TrackingCookieHint | undefined {
  return TRACKING_COOKIES.find((hint) => hint.pattern.test(cookie.name));
}

function evidenceFromRequest(
  request: CapturedRequest,
  detail: string,
): Violation['evidence'] {
  const evidence: Violation['evidence'] = {
    url: request.url,
    domain: request.domain,
    detail,
  };
  if (request.ip) {
    evidence.ip = request.ip;
  }
  if (request.country) {
    evidence.ipCountry = request.country;
  }
  return evidence;
}

/**
 * Rule: Pre-consent tracking leak
 * Category: TRACKING_CONSENT
 *
 * Flags known tracker requests and non-essential tracking cookies observed
 * during the interaction-free initial load. Each finding is CRITICAL (−30),
 * with the orchestrator capping total CRITICAL deductions at −60.
 */
export const trackerLeakRule: ComplianceRule = {
  id: 'tracker-leak',
  name: 'Pre-consent tracking leak',
  category: 'TRACKING_CONSENT',
  description:
    'Detects known analytics/advertising trackers and tracking cookies that fire before the user grants consent.',
  async evaluate(context: ScanContext): Promise<Violation[]> {
    const violations: Violation[] = [];
    const seenDomains = new Set<string>();

    for (const hit of context.requests) {
      const vendor = matchVendor(hit.domain);
      if (!vendor) {
        continue;
      }
      const key = hit.domain.toLowerCase();
      if (seenDomains.has(key)) {
        continue;
      }
      seenDomains.add(key);

      violations.push({
        id: `${trackerLeakRule.id}-request-${violations.length}`,
        ruleName: trackerLeakRule.name,
        severity: 'CRITICAL',
        message: `${vendor.label} (${hit.domain}) loaded on first paint before any consent click.`,
        evidence: evidenceFromRequest(
          hit,
          `${vendor.label} request observed before consent`,
        ),
        recommendation: vendor.fix,
      });
    }

    for (const cookie of context.cookies) {
      const hint = matchTrackingCookie(cookie);
      if (!hint) {
        continue;
      }

      violations.push({
        id: `${trackerLeakRule.id}-cookie-${violations.length}`,
        ruleName: trackerLeakRule.name,
        severity: 'CRITICAL',
        message: `${hint.label} was written before any consent click.`,
        evidence: {
          cookieName: cookie.name,
          domain: cookie.domain,
          detail: `Cookie path ${cookie.path} on ${cookie.domain}`,
        },
        recommendation: hint.fix,
      });
    }

    return violations;
  },
};
