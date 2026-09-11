import type { ComplianceRule, ScanContext, Violation } from '../types/index.js';

/**
 * Rule: First-layer consent banner & reject button
 * Category: BANNER_DARK_PATTERN
 *
 * When third-party requests or cookies are present, requires a detectable
 * consent banner and an equal-prominence Reject / Ablehnen control on the
 * first layer.
 */
export const bannerCheckRule: ComplianceRule = {
  id: 'banner-check',
  name: 'First-layer consent banner & reject button',
  category: 'BANNER_DARK_PATTERN',
  description:
    'Requires a consent banner with an explicit Reject/Ablehnen control when third-party activity is observed.',
  async evaluate(context: ScanContext): Promise<Violation[]> {
    const activity = describeThirdPartyActivity(context);
    if (!activity) {
      return [];
    }

    if (!context.bannerFound) {
      const evidence: Violation['evidence'] = {
        detail: activity.detail,
      };
      if (activity.sampleDomain) {
        evidence.domain = activity.sampleDomain;
      }
      if (activity.sampleUrl) {
        evidence.url = activity.sampleUrl;
      }
      if (activity.sampleCookie) {
        evidence.cookieName = activity.sampleCookie;
      }
      return [
        {
          id: `${bannerCheckRule.id}-missing-banner`,
          ruleName: bannerCheckRule.name,
          severity: 'CRITICAL',
          message: `Third-party activity ran on first paint (${activity.summary}), but no consent banner was detected.`,
          evidence,
          recommendation:
            'Show a CMP/banner on first paint and block non-essential third-party scripts/cookies until the visitor opts in. Confirm the banner markup is in the initial HTML (not only after a late JS inject that KlarAudit may miss).',
        },
      ];
    }

    if (!context.hasRejectButton) {
      const evidence: Violation['evidence'] = {
        detail: activity.detail,
      };
      if (activity.sampleDomain) {
        evidence.domain = activity.sampleDomain;
      }
      if (activity.sampleUrl) {
        evidence.url = activity.sampleUrl;
      }
      if (activity.sampleCookie) {
        evidence.cookieName = activity.sampleCookie;
      }
      return [
        {
          id: `${bannerCheckRule.id}-missing-reject`,
          ruleName: bannerCheckRule.name,
          severity: 'MEDIUM',
          message: `Consent UI found, but no equal-prominence Reject / Ablehnen control on the first layer while third-party activity is present (${activity.summary}).`,
          evidence,
          recommendation:
            'Put Reject / Ablehnen (or “Necessary only”) on the first layer beside Accept at the same visual weight. Do not hide refusal behind a settings-only path.',
        },
      ];
    }

    return [];
  },
};

interface ThirdPartyActivity {
  summary: string;
  detail: string;
  sampleDomain?: string;
  sampleUrl?: string;
  sampleCookie?: string;
}

function describeThirdPartyActivity(context: ScanContext): ThirdPartyActivity | undefined {
  const targetHost = safeHostname(context.targetUrl);
  const thirdPartyHosts = unique(
    context.requests
      .filter((request) => isThirdPartyDomain(request.domain, targetHost))
      .map((request) => request.domain.toLowerCase()),
  );
  const cookieNames = unique(context.cookies.map((cookie) => cookie.name));

  if (thirdPartyHosts.length === 0 && cookieNames.length === 0) {
    return undefined;
  }

  const hostPreview = thirdPartyHosts.slice(0, 3).join(', ');
  const cookiePreview = cookieNames.slice(0, 3).join(', ');
  const summaryParts: string[] = [];
  if (hostPreview) {
    summaryParts.push(
      thirdPartyHosts.length > 3
        ? `hosts ${hostPreview}, +${thirdPartyHosts.length - 3} more`
        : `hosts ${hostPreview}`,
    );
  }
  if (cookiePreview) {
    summaryParts.push(
      cookieNames.length > 3
        ? `cookies ${cookiePreview}, +${cookieNames.length - 3} more`
        : `cookies ${cookiePreview}`,
    );
  }

  const detailParts: string[] = [];
  if (thirdPartyHosts.length > 0) {
    detailParts.push(`Third-party hosts: ${thirdPartyHosts.join(', ')}`);
  }
  if (cookieNames.length > 0) {
    detailParts.push(`Cookies on load: ${cookieNames.join(', ')}`);
  }

  const sampleRequest = context.requests.find((request) =>
    isThirdPartyDomain(request.domain, targetHost),
  );

  const activity: ThirdPartyActivity = {
    summary: summaryParts.join('; '),
    detail: detailParts.join('. '),
  };
  if (sampleRequest) {
    activity.sampleDomain = sampleRequest.domain;
    activity.sampleUrl = sampleRequest.url;
  }
  if (cookieNames[0]) {
    activity.sampleCookie = cookieNames[0];
  }
  return activity;
}

/** Labels commonly used for an equal-prominence reject / decline control. */
const REJECT_LABEL_PATTERN =
  /\b(reject(\s+all)?|ablehnen|alles\s+ablehnen|alle\s+ablehnen|decline(\s+all)?|deny|refuse|necessary\s+only|nur\s+notwendige|essenzielle?\s+only|essenziell[ea]?\s+cookies|save\s+without\s+accepting)\b/i;

/** CMP / framework selectors that typically expose a first-layer reject control. */
const REJECT_SELECTORS: readonly string[] = [
  '#CybotCookiebotDialogBodyButtonDecline',
  '#onetrust-reject-all-handler',
  '.ot-pc-refuse-all-handler',
  '[data-testid="uc-deny-all-button"]',
  '[aria-label*="reject" i]',
  '[aria-label*="ablehnen" i]',
  '[aria-label*="decline" i]',
];

/**
 * Pure DOM heuristic used by unit tests and optional offline analysis.
 * The live scan path relies on {@link ScanContext.hasRejectButton} from the engine probe.
 */
export function hasFirstLayerReject(domSnapshot: string): boolean {
  if (domSnapshot.length === 0) {
    return false;
  }

  for (const selector of REJECT_SELECTORS) {
    if (domContainsSelector(domSnapshot, selector)) {
      return true;
    }
  }

  const interactiveReject =
    /<(?:button|a|input|label)\b[^>]*>[\s\S]{0,200}?<\/(?:button|a|label)>/gi;
  let match: RegExpExecArray | null;
  while ((match = interactiveReject.exec(domSnapshot)) !== null) {
    const chunk = match[0];
    if (REJECT_LABEL_PATTERN.test(chunk)) {
      return true;
    }
    if (
      /\b(?:aria-label|title|value)\s*=\s*["'][^"']*(reject|ablehnen|decline)[^"']*["']/i.test(
        chunk,
      )
    ) {
      return true;
    }
  }

  return REJECT_LABEL_PATTERN.test(domSnapshot);
}

function safeHostname(targetUrl: string): string {
  try {
    return new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isThirdPartyDomain(requestDomain: string, targetHost: string): boolean {
  if (!requestDomain || !targetHost) {
    return false;
  }
  const domain = requestDomain.toLowerCase();
  return domain !== targetHost && !domain.endsWith(`.${targetHost}`);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function domContainsSelector(domSnapshot: string, selector: string): boolean {
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    return new RegExp(`id\\s*=\\s*["']${escapeRegExp(id)}["']`, 'i').test(domSnapshot);
  }

  if (selector.startsWith('.') && !selector.includes('[')) {
    const className = selector.slice(1);
    return new RegExp(
      `class\\s*=\\s*["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["']`,
      'i',
    ).test(domSnapshot);
  }

  const attrMatch = /^\[([a-z0-9:-]+)(\*=)["']([^"']+)["']\s*i?\]$/i.exec(selector);
  if (attrMatch) {
    const attr = attrMatch[1];
    const value = attrMatch[3];
    if (!attr || !value) {
      return false;
    }
    return new RegExp(
      `${escapeRegExp(attr)}\\s*=\\s*["'][^"']*${escapeRegExp(value)}[^"']*["']`,
      'i',
    ).test(domSnapshot);
  }

  return domSnapshot.toLowerCase().includes(selector.toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
