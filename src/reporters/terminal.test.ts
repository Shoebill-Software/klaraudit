import { describe, expect, it } from 'vitest';
import type { AuditResult, Violation } from '../types/index.js';
import { formatTerminalReport } from './terminal.js';

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function compact(value: string): string {
  return stripAnsi(value).replace(/\s+/g, ' ');
}

function sampleResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    targetUrl: 'https://example.com/',
    scanDate: '2026-09-06T15:00:00.000Z',
    score: 55,
    status: 'NON_COMPLIANT',
    violations: [
      {
        id: 'tracker-leak-ga',
        ruleName: 'Pre-consent tracking leak',
        severity: 'CRITICAL',
        message: 'Google Analytics fired before consent.',
        evidence: { url: 'https://www.google-analytics.com/g/collect', domain: 'www.google-analytics.com' },
        recommendation: 'Block analytics until the user opts in.',
      },
    ],
    metrics: {
      totalRequests: 12,
      thirdPartyRequests: 4,
      cookiesSetBeforeConsent: 2,
      hasRejectButton: false,
      mandatoryPagesFound: true,
      totalCookies: 3,
      nonEuTransfers: 2,
    },
    ...overrides,
  };
}

describe('formatTerminalReport', () => {
  it('prints a header with URL, timestamp, score, and compliance badge', () => {
    const report = stripAnsi(formatTerminalReport(sampleResult()));

    expect(report).toContain('KLARAUDIT');
    expect(report).toContain('EU Privacy & GDPR Compliance Scanner');
    expect(report).toContain('https://example.com/');
    expect(report).toContain('2026-09-06T15:00:00.000Z');
    expect(report).toContain('Score');
    expect(report).toContain('55');
    expect(report).toContain('NON_COMPLIANT');
  });

  it('prints a summary table of request, cookie, and transfer stats', () => {
    const report = stripAnsi(formatTerminalReport(sampleResult()));

    expect(report).toContain('Summary');
    expect(report).toContain('Total Requests');
    expect(report).toContain('12');
    expect(report).toContain('Cookies');
    expect(report).toContain('3');
    expect(report).toContain('Third-Party Requests');
    expect(report).toContain('4');
    expect(report).toContain('Non-EU Transfers');
    expect(report).toContain('2');
  });

  it('prints a violations table with severity, category, title, deduction, and remediation', () => {
    const report = compact(formatTerminalReport(sampleResult()));

    expect(report).toContain('Severity');
    expect(report).toContain('Category');
    expect(report).toContain('Title');
    expect(report).toContain('Deduction');
    expect(report).toContain('Remediation');
    expect(report).toContain('CRITICAL');
    expect(report).toContain('TRACKING_CONSENT');
    expect(report).toContain('Google Analytics fired');
    expect(report).toContain('before consent.');
    expect(report).toContain('-30');
    expect(report).toContain('Block analytics until the user');
    expect(report).toContain('opts in.');
  });

  it('color-codes COMPLIANT / WARNING / NON_COMPLIANT badges and CI gate copy', () => {
    const pass = stripAnsi(
      formatTerminalReport(sampleResult({ score: 90, status: 'COMPLIANT', violations: [] })),
    );
    expect(pass).toContain('COMPLIANT');
    expect(pass).toContain('No violations detected.');
    expect(pass).toContain('CI gate: PASS');

    const warn = stripAnsi(
      formatTerminalReport(
        sampleResult({
          score: 70,
          status: 'WARNING',
          violations: [
            {
              id: 'legal-pages-missing-impressum',
              ruleName: 'Mandatory legal pages',
              severity: 'LOW',
              message: 'Impressum page is missing.',
              evidence: {},
              recommendation: 'Publish /impressum.',
            },
          ],
        }),
      ),
    );
    expect(warn).toContain('WARNING');
    expect(warn).toContain('CI gate: PASS');

    const fail = stripAnsi(formatTerminalReport(sampleResult({ score: 20, status: 'NON_COMPLIANT' })));
    expect(fail).toContain('NON_COMPLIANT');
    expect(fail).toContain('CI gate: FAIL');
  });

  it('lists HIGH findings with category, deduction, and remediation', () => {
    const extra: Violation = {
      id: 'google-fonts',
      ruleName: 'Dynamic Google Fonts & IP leak',
      severity: 'HIGH',
      message: 'Dynamic Google Fonts leak visitor IPs.',
      evidence: { domain: 'fonts.googleapis.com' },
      recommendation: 'Self-host the font files.',
    };
    const report = compact(
      formatTerminalReport(sampleResult({ status: 'WARNING', score: 70, violations: [extra] })),
    );
    expect(report).toContain('Self-host the font files.');
    expect(report).toContain('HIGH');
    expect(report).toContain('CROSS_BORDER_TRANSFER');
    expect(report).toContain('-15');
    expect(report).toContain('CI gate: FAIL');
  });
});
