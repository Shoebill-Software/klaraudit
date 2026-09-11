import type { CapturedRequest, ComplianceRule, ScanContext, Violation } from '../types/index.js';

const GOOGLE_FONTS_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'] as const;

const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  CH: 'Switzerland',
  AU: 'Australia',
  SG: 'Singapore',
  JP: 'Japan',
  IN: 'India',
  BR: 'Brazil',
  DE: 'Germany',
};

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

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** True when the request host is the scan target (or a subdomain of it). */
function isFirstPartyRequest(request: CapturedRequest, targetUrl: string): boolean {
  const targetHost = hostnameOf(targetUrl);
  if (!targetHost) {
    return false;
  }
  const domain = request.domain.toLowerCase();
  return (
    domain === targetHost ||
    targetHost.endsWith(`.${domain}`) ||
    domain.endsWith(`.${targetHost}`)
  );
}

function countryLabel(code: string | undefined): string {
  if (!code) {
    return 'an unknown country';
  }
  const name = COUNTRY_NAMES[code.toUpperCase()];
  return name ? `${code.toUpperCase()} (${name})` : code.toUpperCase();
}

function locationClause(request: CapturedRequest): string {
  const where = countryLabel(request.country);
  if (request.ip) {
    return `IP ${request.ip} in ${where}`;
  }
  return `a server in ${where}`;
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
      const firstParty = isFirstPartyRequest(hit, context.targetUrl);
      const evidence: Violation['evidence'] = {
        url: hit.url,
        domain: hit.domain,
      };
      if (hit.ip) {
        evidence.ip = hit.ip;
      }
      if (hit.country) {
        evidence.ipCountry = hit.country;
      }

      let message: string;
      let recommendation: string;

      if (fontsHit) {
        message = `Google Fonts loaded from ${hit.domain} on first paint (${locationClause(hit)}), sending the visitor IP to Google before consent. German courts have treated this as a GDPR violation.`;
        recommendation =
          'Self-host the font files, or load Google Fonts only after explicit consent. Remove <link>/CSS imports to fonts.googleapis.com and fonts.gstatic.com from the initial HTML.';
      } else if (firstParty) {
        message = `Your own origin ${hit.domain} resolved to ${locationClause(hit)} — outside the EU/EEA. This usually means the host or CDN edge (for example Vercel, Cloudflare, Netlify) served the page from a non-EU region, not that a third-party tracker fired.`;
        recommendation =
          'If you need EU-only routing, pin the project to an EU region / EU CDN edge. Otherwise treat your host as a processor and document the transfer basis (SCCs / EU–US DPF) in your privacy notice. This finding is about where the server IP geo-locates, not about embedded trackers.';
      } else {
        message = `Third-party host ${hit.domain} resolved to ${locationClause(hit)} — outside the EU/EEA — with no DPF/SCC cue in the request metadata.`;
        recommendation =
          'Identify what loads from this host on first paint. Prefer an EU endpoint, delay the load until consent, or document an appropriate transfer mechanism (EU–US DPF or SCCs) for that processor.';
      }

      if (fontsHit) {
        evidence.detail = `Google Fonts stylesheet/font request on first paint`;
      } else if (firstParty) {
        evidence.detail = `First-party origin / CDN edge GeoIP ${hit.country ?? 'unknown'}`;
      } else {
        evidence.detail = `Third-party asset on first paint · GeoIP ${hit.country ?? 'unknown'}`;
      }

      violations.push({
        id: `${googleFontsRule.id}-${violations.length}`,
        ruleName: googleFontsRule.name,
        severity: 'HIGH',
        message,
        evidence,
        recommendation,
      });
    }

    return violations;
  },
};
