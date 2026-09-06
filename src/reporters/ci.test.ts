import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditResult, Violation } from '../types/index.js';
import {
  ciGateReasons,
  countCiBlockingViolations,
  failCiIfBlocked,
  failsCiGate,
  hasCiBlockingViolations,
} from './ci.js';

function violation(severity: Violation['severity']): Violation {
  return {
    id: 'v',
    ruleName: 'r',
    severity,
    message: 'm',
    evidence: {},
    recommendation: 'x',
  };
}

describe('CI gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats CRITICAL and HIGH as blocking', () => {
    expect(hasCiBlockingViolations([violation('MEDIUM')])).toBe(false);
    expect(hasCiBlockingViolations([violation('CRITICAL')])).toBe(true);
    expect(hasCiBlockingViolations([violation('HIGH'), violation('LOW')])).toBe(true);
    expect(countCiBlockingViolations([violation('CRITICAL'), violation('HIGH'), violation('INFO')])).toBe(
      2,
    );
  });

  it('prints an error and exits 1 when blocking violations exist', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as typeof process.exit);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => failCiIfBlocked([violation('HIGH')])).toThrow('exit 1');
    expect(err).toHaveBeenCalledWith(
      'KlarAudit CI failed: 1 CRITICAL or HIGH violation found.',
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not exit when only medium or lower findings exist', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as typeof process.exit);

    failCiIfBlocked([violation('MEDIUM'), violation('LOW')]);
    expect(exit).not.toHaveBeenCalled();
  });
});

function gateResult(
  status: AuditResult['status'],
  severities: Violation['severity'][],
): Pick<AuditResult, 'status' | 'violations'> {
  return {
    status,
    violations: severities.map((severity) => violation(severity)),
  };
}

describe('failsCiGate', () => {
  it('fails on NON_COMPLIANT even without CRITICAL/HIGH findings', () => {
    const result = gateResult('NON_COMPLIANT', ['LOW']);
    expect(failsCiGate(result)).toBe(true);
    expect(ciGateReasons(result)).toEqual(['status is NON_COMPLIANT']);
  });

  it('fails on CRITICAL or HIGH even when status is COMPLIANT', () => {
    const result = gateResult('COMPLIANT', ['HIGH']);
    expect(failsCiGate(result)).toBe(true);
    expect(ciGateReasons(result)).toEqual(['CRITICAL or HIGH violations present']);
  });

  it('passes WARNING with only medium or lower findings', () => {
    const result = gateResult('WARNING', ['MEDIUM', 'LOW']);
    expect(failsCiGate(result)).toBe(false);
    expect(ciGateReasons(result)).toEqual([]);
  });
});

