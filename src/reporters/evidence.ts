import type { Violation } from '../types/index.js';

/**
 * One-line / multi-line evidence for terminal and PDF so findings are actionable.
 */
export function formatEvidenceSummary(evidence: Violation['evidence']): string {
  const parts: string[] = [];

  if (evidence.detail) {
    parts.push(evidence.detail);
  }
  if (evidence.cookieName) {
    parts.push(`cookie: ${evidence.cookieName}`);
  }
  if (evidence.elementSelector) {
    parts.push(`selector: ${evidence.elementSelector}`);
  }
  if (evidence.url) {
    parts.push(evidence.url);
  } else if (evidence.domain) {
    parts.push(evidence.domain);
  }

  if (evidence.ip && evidence.ipCountry) {
    parts.push(`${evidence.ip} · GeoIP ${evidence.ipCountry}`);
  } else if (evidence.ip) {
    parts.push(evidence.ip);
  } else if (evidence.ipCountry) {
    parts.push(`GeoIP ${evidence.ipCountry}`);
  }

  return uniquePreserveOrder(parts).join('\n');
}

function uniquePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
