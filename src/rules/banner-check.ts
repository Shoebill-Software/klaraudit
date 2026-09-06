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
    if (!hasThirdPartyActivity(context)) {
      return [];
    }

    if (!context.bannerFound) {
      return [
        {
          id: `${bannerCheckRule.id}-missing-banner`,
          ruleName: bannerCheckRule.name,
          severity: 'CRITICAL',
          message:
            'Third-party requests or cookies were observed, but no consent banner was detected on the first layer.',
          evidence: {},
          recommendation:
            'Present a clear first-layer consent banner before firing non-essential third-party scripts or setting tracking cookies.',
        },
      ];
    }

    if (!context.hasRejectButton) {
      return [
        {
          id: `${bannerCheckRule.id}-missing-reject`,
          ruleName: bannerCheckRule.name,
          severity: 'MEDIUM',
          message:
            'Consent banner detected, but no equal-prominence "Reject" / "Ablehnen" option is available on the first layer.',
          evidence: {},
          recommendation:
            'Provide an equally prominent first-layer Reject/Ablehnen (or equivalent) control next to Accept. Do not bury refusal behind secondary settings-only flows.',
        },
      ];
    }

    return [];
  },
};

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

function hasThirdPartyActivity(context: ScanContext): boolean {
  if (context.cookies.length > 0) {
    return true;
  }

  const targetHost = safeHostname(context.targetUrl);
  return context.requests.some((request) => isThirdPartyDomain(request.domain, targetHost));
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
