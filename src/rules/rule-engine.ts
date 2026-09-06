import type {
  AuditResult,
  CapturedCookie,
  ComplianceRule,
  ComplianceStatus,
  MetricData,
  ScanContext,
  Severity,
  Violation,
} from '../types/index.js';
import { bannerCheckRule } from './banner-check.js';
import { googleFontsRule } from './google-fonts.js';
import { legalPagesRule } from './legal-pages.js';
import { trackerLeakRule } from './tracker-leak.js';

/**
 * Per-incident severity weights for AuditResult.score.
 *
 *   Base: 100
 *   CRITICAL: -30 each (total CRITICAL penalty capped at -60)
 *   HIGH:     -15 each
 *   MEDIUM:   -10 each
 *   LOW:      -5 each
 *   INFO:     0
 *   Floor:    0
 *
 * @see SPEC.md Scoring
 */
export const SEVERITY_PENALTIES: Readonly<Record<Severity, number>> = {
  CRITICAL: 30,
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5,
  INFO: 0,
};

/** Maximum total deduction from CRITICAL violations (−60). */
export const CRITICAL_PENALTY_CAP = 60;

/** Score band thresholds for {@link ComplianceStatus}. */
export const STATUS_COMPLIANT_MIN = 85;
export const STATUS_WARNING_MIN = 60;

export const DEFAULT_RULES: readonly ComplianceRule[] = [
  trackerLeakRule,
  googleFontsRule,
  bannerCheckRule,
  legalPagesRule,
];

export interface RuleExecutionError {
  ruleId: string;
  ruleName: string;
  message: string;
}

export interface RuleEngineResult {
  violations: Violation[];
  score: number;
  status: ComplianceStatus;
  metrics: MetricData;
  ruleErrors: RuleExecutionError[];
}

/**
 * Executes every compliance rule against the captured `ScanContext`.
 * Individual rule failures are isolated and reported in `ruleErrors`.
 */
export async function runRules(
  context: ScanContext,
  rules: readonly ComplianceRule[] = DEFAULT_RULES,
): Promise<RuleEngineResult> {
  const violations: Violation[] = [];
  const ruleErrors: RuleExecutionError[] = [];

  for (const rule of rules) {
    try {
      const findings = await rule.evaluate(context);
      violations.push(...findings);
    } catch (error: unknown) {
      ruleErrors.push({
        ruleId: rule.id,
        ruleName: rule.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const metrics = buildMetrics(context, violations, ruleErrors);
  const score = calculateScore(violations);
  const status = assignComplianceStatus(score);

  return { violations, score, status, metrics, ruleErrors };
}

/**
 * Orchestrates all rule evaluators, accumulates violations, scores the scan,
 * and returns a full {@link AuditResult}.
 */
export async function runAudit(
  context: ScanContext,
  rules: readonly ComplianceRule[] = DEFAULT_RULES,
): Promise<AuditResult> {
  const { violations, score, status, metrics } = await runRules(context, rules);
  return {
    targetUrl: context.targetUrl,
    scanDate: (context.endTime ?? new Date()).toISOString(),
    score,
    status,
    violations,
    metrics,
  };
}

/** @deprecated Prefer {@link runAudit}. */
export async function evaluateScan(
  context: ScanContext,
  rules: readonly ComplianceRule[] = DEFAULT_RULES,
): Promise<AuditResult> {
  return runAudit(context, rules);
}

/**
 * Aggregate compliance score from 100 with severity-weighted deductions.
 * CRITICAL deductions are capped at {@link CRITICAL_PENALTY_CAP}.
 * @see SEVERITY_PENALTIES
 */
export function calculateScore(violations: readonly Violation[]): number {
  let criticalPenalty = 0;
  let otherPenalty = 0;

  for (const violation of violations) {
    const weight = SEVERITY_PENALTIES[violation.severity] ?? 0;
    if (violation.severity === 'CRITICAL') {
      criticalPenalty += weight;
    } else {
      otherPenalty += weight;
    }
  }

  const totalPenalty = Math.min(criticalPenalty, CRITICAL_PENALTY_CAP) + otherPenalty;
  return Math.max(0, 100 - totalPenalty);
}

/**
 * Maps a composite score to COMPLIANT / WARNING / NON_COMPLIANT.
 */
export function assignComplianceStatus(score: number): ComplianceStatus {
  if (score >= STATUS_COMPLIANT_MIN) {
    return 'COMPLIANT';
  }
  if (score >= STATUS_WARNING_MIN) {
    return 'WARNING';
  }
  return 'NON_COMPLIANT';
}

function buildMetrics(
  context: ScanContext,
  violations: readonly Violation[],
  ruleErrors: readonly RuleExecutionError[],
): MetricData {
  const targetHost = safeHostname(context.targetUrl);
  const thirdPartyRequests = context.requests.filter((request) =>
    isThirdPartyDomain(request.domain, targetHost),
  ).length;

  const cookiesSetBeforeConsent = context.cookies.filter((cookie) =>
    isNonEssentialPersistentCookie(cookie),
  ).length;

  const nonEuTransfers = context.requests.filter((request) => request.isNonEU).length;

  const legalPageIssue =
    violations.some((v) => v.id.startsWith('legal-pages-')) ||
    ruleErrors.some((error) => error.ruleId === 'legal-pages');
  const mandatoryPagesFound =
    !legalPageIssue &&
    context.mandatoryPages.impressum.found &&
    context.mandatoryPages.impressum.status === 200 &&
    context.mandatoryPages.datenschutz.found &&
    context.mandatoryPages.datenschutz.status === 200;

  return {
    totalRequests: context.requests.length,
    thirdPartyRequests,
    cookiesSetBeforeConsent,
    hasRejectButton: context.hasRejectButton,
    mandatoryPagesFound,
    totalCookies: context.cookies.length,
    nonEuTransfers,
  };
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

/**
 * Persistent cookies that do not match common essential / consent patterns
 * are counted as pre-consent storage (compliance-rules.mdc §1).
 */
function isNonEssentialPersistentCookie(cookie: CapturedCookie): boolean {
  // Playwright uses -1 for session cookies.
  if (cookie.expires < 0) {
    return false;
  }

  const name = cookie.name.toLowerCase();
  if (name === 'phpsessid' || name === 'xsrf-token') {
    return false;
  }
  if (name.startsWith('__host-') || name.startsWith('__secure-')) {
    return false;
  }
  if (name.includes('consent') || name.includes('csrf')) {
    return false;
  }

  return true;
}
