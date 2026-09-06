import type { AuditResult, Severity, Violation } from '../types/index.js';

const CI_BLOCKING_SEVERITIES: ReadonlySet<Severity> = new Set(['CRITICAL', 'HIGH']);

export function isCiBlockingSeverity(severity: Severity): boolean {
  return CI_BLOCKING_SEVERITIES.has(severity);
}

export function countCiBlockingViolations(violations: readonly Violation[]): number {
  return violations.filter((violation) => isCiBlockingSeverity(violation.severity)).length;
}

export function hasCiBlockingViolations(violations: readonly Violation[]): boolean {
  return countCiBlockingViolations(violations) > 0;
}

/**
 * Human-readable reasons the `--ci` gate would fail.
 * Fails when status is NON_COMPLIANT or any CRITICAL/HIGH finding exists.
 */
export function ciGateReasons(
  result: Pick<AuditResult, 'status' | 'violations'>,
): string[] {
  const reasons: string[] = [];
  if (result.status === 'NON_COMPLIANT') {
    reasons.push('status is NON_COMPLIANT');
  }
  if (hasCiBlockingViolations(result.violations)) {
    reasons.push('CRITICAL or HIGH violations present');
  }
  return reasons;
}

export function failsCiGate(result: Pick<AuditResult, 'status' | 'violations'>): boolean {
  return ciGateReasons(result).length > 0;
}

/**
 * In `--ci` mode, fail the process when any CRITICAL or HIGH finding exists.
 * Reports go to stderr; the process then exits with status 1.
 */
export function failCiIfBlocked(violations: readonly Violation[]): void {
  const blockingCount = countCiBlockingViolations(violations);
  if (blockingCount === 0) {
    return;
  }

  const noun = blockingCount === 1 ? 'violation' : 'violations';
  console.error(
    `KlarAudit CI failed: ${blockingCount} CRITICAL or HIGH ${noun} found.`,
  );
  process.exit(1);
}
