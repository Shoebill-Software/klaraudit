import type {
  CapturedCookie,
  CapturedRequest,
  ComplianceRule,
  ScanContext,
  Violation,
} from '../types/index.js';

/**
 * Known tracking / analytics hosts that must not fire before consent
 * (e-Privacy Directive / GDPR Art. 5(3)).
 */
const TRACKING_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'tiktok.com',
  'clarity.ms',
  'doubleclick.net',
  'criteo.com',
] as const;

/** Non-essential tracking cookies commonly set prior to consent. */
const TRACKING_COOKIE_PATTERNS: readonly RegExp[] = [
  /^_ga$/i,
  /^_gid$/i,
  /^_fbp$/i,
  /^_clck$/i,
  /^_hjSession/i,
];

function includesTrackingDomain(request: CapturedRequest): boolean {
  const domain = request.domain.toLowerCase();
  return TRACKING_DOMAINS.some(
    (host) => domain === host || domain.endsWith(`.${host}`),
  );
}

function isTrackingCookie(cookie: CapturedCookie): boolean {
  return TRACKING_COOKIE_PATTERNS.some((pattern) => pattern.test(cookie.name));
}

function evidenceFromRequest(request: CapturedRequest): Violation['evidence'] {
  const evidence: Violation['evidence'] = {
    url: request.url,
    domain: request.domain,
  };
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

    const trackerHits = context.requests.filter(includesTrackingDomain);
    for (const [index, hit] of trackerHits.entries()) {
      violations.push({
        id: `${trackerLeakRule.id}-request-${index}`,
        ruleName: trackerLeakRule.name,
        severity: 'CRITICAL',
        message: `Tracking request to ${hit.domain} fired before user consent.`,
        evidence: evidenceFromRequest(hit),
        recommendation:
          'Block all non-essential tracking scripts and pixels until the user explicitly opts in via the consent banner (e-Privacy Art. 5(3) / GDPR).',
      });
    }

    const trackingCookies = context.cookies.filter(isTrackingCookie);
    for (const [index, cookie] of trackingCookies.entries()) {
      violations.push({
        id: `${trackerLeakRule.id}-cookie-${index}`,
        ruleName: trackerLeakRule.name,
        severity: 'CRITICAL',
        message: `Non-essential tracking cookie "${cookie.name}" was set before user consent.`,
        evidence: {
          cookieName: cookie.name,
          domain: cookie.domain,
        },
        recommendation:
          'Defer setting analytics and advertising cookies (e.g. _ga, _fbp, _clck, _hjSession*) until after affirmative consent.',
      });
    }

    return violations;
  },
};
