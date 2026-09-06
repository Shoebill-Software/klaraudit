import type { CapturedRequest, ComplianceRule, ScanContext, Violation } from '../types/index.js';

const GOOGLE_FONTS_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'] as const;

/**
 * Keywords that indicate a documented EU–US transfer safeguard (DPF / SCCs).
 * CapturedRequest has no structured annotation field today, so these are matched
 * against URL / domain text when present in the request metadata.
 */
const TRANSFER_SAFEGUARD_PATTERN =
  /\b(dpf|data\s*privacy\s*framework|scc|standard\s*contractual\s*clauses|eu[_-]?us)\b/i;

function isGoogleFontsRequest(domain: string): boolean {
  const lowered = domain.toLowerCase();
  return GOOGLE_FONTS_HOSTS.some(
    (host) => lowered === host || lowered.endsWith(`.${host}`),
  );
}

function hasTransferSafeguardAnnotation(request: CapturedRequest): boolean {
  return (
    TRANSFER_SAFEGUARD_PATTERN.test(request.url) ||
    TRANSFER_SAFEGUARD_PATTERN.test(request.domain)
  );
}

function isCrossBorderAssetViolation(request: CapturedRequest): boolean {
  if (isGoogleFontsRequest(request.domain)) {
    return true;
  }
  return request.isNonEU && !hasTransferSafeguardAnnotation(request);
}

function assetKey(request: CapturedRequest): string {
  return request.domain.toLowerCase();
}

/**
 * Rule: Dynamic Google Fonts & IP leak
 * Category: CROSS_BORDER_TRANSFER
 *
 * Flags fonts.googleapis.com / fonts.gstatic.com loads and other non-EU
 * requests lacking EU–US DPF / SCC annotations. One HIGH (−15) finding per
 * unique cross-border asset (domain).
 */
export const googleFontsRule: ComplianceRule = {
  id: 'google-fonts',
  name: 'Dynamic Google Fonts & IP leak',
  category: 'CROSS_BORDER_TRANSFER',
  description:
    'Detects dynamic Google Fonts CDN loads and other non-EU transfers without DPF/SCC safeguards.',
  async evaluate(context: ScanContext): Promise<Violation[]> {
    const seen = new Set<string>();
    const violations: Violation[] = [];

    for (const hit of context.requests) {
      if (!isCrossBorderAssetViolation(hit)) {
        continue;
      }

      const key = assetKey(hit);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const fontsHit = isGoogleFontsRequest(hit.domain);
      const evidence: Violation['evidence'] = {
        url: hit.url,
        domain: hit.domain,
      };
      if (hit.country) {
        evidence.ipCountry = hit.country;
      }

      violations.push({
        id: `${googleFontsRule.id}-${violations.length}`,
        ruleName: googleFontsRule.name,
        severity: 'HIGH',
        message: fontsHit
          ? 'Dynamic Google Fonts request transfers the visitor IP address to Google without prior consent. German courts have held that such dynamic loading violates GDPR.'
          : `Cross-border request to non-EU host ${hit.domain} lacks EU–US Data Privacy Framework / Standard Contractual Clauses annotations.`,
        evidence,
        recommendation: fontsHit
          ? 'Self-host web fonts or load them only after explicit consent. Avoid linking stylesheets or font files from fonts.googleapis.com / fonts.gstatic.com on first paint.'
          : 'Document an appropriate transfer mechanism (EU–US DPF certification or SCCs) for non-EU processors, or serve the asset from an EU endpoint before consent.',
      });
    }

    return violations;
  },
};
