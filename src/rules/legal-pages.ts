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

    if (isUnreachable(impressum)) {
      violations.push({
        id: `${legalPagesRule.id}-missing-impressum`,
        ruleName: legalPagesRule.name,
        severity: 'LOW',
        message:
          'Impressum page is missing or did not return HTTP 200. An imprint page is mandatory for many EU/German commercial sites.',
        evidence: { url: impressum.url ?? `${safeOrigin(context.targetUrl)}/impressum` },
        recommendation:
          'Publish a publicly reachable Impressum/Imprint page at /impressum or /imprint that returns HTTP 200.',
      });
    }

    if (isUnreachable(datenschutz)) {
      violations.push({
        id: `${legalPagesRule.id}-missing-privacy`,
        ruleName: legalPagesRule.name,
        severity: 'LOW',
        message:
          'Datenschutz / privacy page is missing or did not return HTTP 200. A privacy policy page is required under GDPR transparency obligations.',
        evidence: {
          url: datenschutz.url ?? `${safeOrigin(context.targetUrl)}/datenschutz`,
        },
        recommendation:
          'Publish a publicly reachable privacy policy at /datenschutz or /privacy that returns HTTP 200.',
      });
    }

    return violations;
  },
};

function isUnreachable(check: MandatoryPageCheck): boolean {
  return !check.found || check.status !== 200;
}

function safeOrigin(targetUrl: string): string {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return targetUrl;
  }
}
