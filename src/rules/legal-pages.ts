import type {
  ComplianceRule,
  MandatoryPageCheck,
  ScanContext,
  Violation,
} from '../types/index.js';

/**
 * Rule: Mandatory legal pages
 * Category: MANDATORY_PAGES
 *
 * Verifies impressum and datenschutz reachability (HTTP 200).
 * Each missing or non-200 page is a LOW (−5) finding.
 */
export const legalPagesRule: ComplianceRule = {
  id: 'legal-pages',
  name: 'Mandatory legal pages',
  category: 'MANDATORY_PAGES',
  description:
    'Checks that impressum and datenschutz (or imprint / privacy equivalents) return HTTP 200.',
  async evaluate(context: ScanContext): Promise<Violation[]> {
    const { impressum, datenschutz } = context.mandatoryPages;
    const violations: Violation[] = [];
    const origin = safeOrigin(context.targetUrl);

    if (isUnreachable(impressum)) {
      const triedUrl = impressum.url ?? `${origin}/impressum`;
      violations.push({
        id: `${legalPagesRule.id}-missing-impressum`,
        ruleName: legalPagesRule.name,
        severity: 'LOW',
        message: `Impressum / imprint is missing or not HTTP 200 (got ${statusLabel(impressum)} for ${triedUrl}).`,
        evidence: {
          url: triedUrl,
          detail: `Probed /impressum and /imprint · status ${statusLabel(impressum)}`,
        },
        recommendation:
          'Publish a publicly reachable Impressum/Imprint at /impressum or /imprint that returns HTTP 200 without login.',
      });
    }

    if (isUnreachable(datenschutz)) {
      const triedUrl = datenschutz.url ?? `${origin}/datenschutz`;
      violations.push({
        id: `${legalPagesRule.id}-missing-privacy`,
        ruleName: legalPagesRule.name,
        severity: 'LOW',
        message: `Datenschutz / privacy policy is missing or not HTTP 200 (got ${statusLabel(datenschutz)} for ${triedUrl}).`,
        evidence: {
          url: triedUrl,
          detail: `Probed /datenschutz and /privacy · status ${statusLabel(datenschutz)}`,
        },
        recommendation:
          'Publish a publicly reachable privacy policy at /datenschutz or /privacy that returns HTTP 200 without login.',
      });
    }

    return violations;
  },
};

function isUnreachable(check: MandatoryPageCheck): boolean {
  return !check.found || check.status !== 200;
}

function statusLabel(check: MandatoryPageCheck): string {
  if (!check.found && check.status === 0) {
    return 'unreachable';
  }
  if (!check.found) {
    return `not found (HTTP ${check.status || 'n/a'})`;
  }
  return `HTTP ${check.status}`;
}

function safeOrigin(targetUrl: string): string {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return targetUrl;
  }
}
