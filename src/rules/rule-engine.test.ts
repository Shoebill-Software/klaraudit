import { describe, expect, it, vi } from 'vitest';
import type { CapturedRequest, ScanContext } from '../types/index.js';
import { bannerCheckRule, hasFirstLayerReject } from './banner-check.js';
import { googleFontsRule } from './google-fonts.js';
import {
  assignComplianceStatus,
  calculateScore,
  CRITICAL_PENALTY_CAP,
  runRules,
  SEVERITY_PENALTIES,
} from './rule-engine.js';
import { trackerLeakRule } from './tracker-leak.js';

function emptyContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    targetUrl: 'https://example.com/',
    startTime: new Date('2026-09-06T12:00:00.000Z'),
    requests: [],
    cookies: [],
    bannerFound: false,
    hasRejectButton: false,
    mandatoryPages: {
      impressum: { found: true, status: 200, url: 'https://example.com/impressum' },
      datenschutz: { found: true, status: 200, url: 'https://example.com/datenschutz' },
    },
    ...overrides,
  };
}

function capturedRequest(
  overrides: Partial<CapturedRequest> & Pick<CapturedRequest, 'url' | 'domain'>,
): CapturedRequest {
  return {
    method: 'GET',
    status: 200,
    isNonEU: false,
    ...overrides,
  };
}

function thirdPartyRequest(): CapturedRequest {
  return capturedRequest({
    url: 'https://cdn.thirdparty.test/script.js',
    domain: 'cdn.thirdparty.test',
  });
}

function violation(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO', id: string) {
  return {
    id,
    ruleName: 'r',
    severity,
    message: 'm',
    evidence: {},
    recommendation: 'x',
  };
}

describe('calculateScore', () => {
  it('starts at 100 and deducts severity penalties', () => {
    expect(calculateScore([])).toBe(100);
    expect(calculateScore([violation('CRITICAL', 'a'), violation('HIGH', 'b')])).toBe(
      100 - SEVERITY_PENALTIES.CRITICAL - SEVERITY_PENALTIES.HIGH,
    );
  });

  it('caps CRITICAL deductions at -60', () => {
    const violations = Array.from({ length: 5 }, (_, index) =>
      violation('CRITICAL', `c-${index}`),
    );
    expect(calculateScore(violations)).toBe(100 - CRITICAL_PENALTY_CAP);
  });

  it('still floors the total score at 0', () => {
    const violations = [
      ...Array.from({ length: 3 }, (_, index) => violation('CRITICAL', `c-${index}`)),
      ...Array.from({ length: 5 }, (_, index) => violation('HIGH', `h-${index}`)),
    ];
    // critical capped at 60 + high 5×15 = 75 → 135 → floor 0
    expect(calculateScore(violations)).toBe(0);
  });
});

describe('assignComplianceStatus', () => {
  it('maps score bands to COMPLIANT / WARNING / NON_COMPLIANT', () => {
    expect(assignComplianceStatus(100)).toBe('COMPLIANT');
    expect(assignComplianceStatus(85)).toBe('COMPLIANT');
    expect(assignComplianceStatus(84)).toBe('WARNING');
    expect(assignComplianceStatus(60)).toBe('WARNING');
    expect(assignComplianceStatus(59)).toBe('NON_COMPLIANT');
  });
});

describe('trackerLeakRule', () => {
  it('returns CRITICAL violations for pre-consent analytics requests', async () => {
    const context = emptyContext({
      requests: [
        capturedRequest({
          url: 'https://www.google-analytics.com/g/collect?v=2',
          domain: 'www.google-analytics.com',
          ip: '1.2.3.4',
          country: 'US',
          isNonEU: true,
        }),
      ],
    });

    const violations = await trackerLeakRule.evaluate(context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('CRITICAL');
    expect(violations[0]?.evidence.url).toContain('google-analytics.com');
    expect(violations[0]?.evidence.ipCountry).toBe('US');
  });

  it('flags known tracking cookies set before consent', async () => {
    const context = emptyContext({
      cookies: [
        {
          name: '_ga',
          domain: '.example.com',
          path: '/',
          expires: Date.now() / 1000 + 86_400,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax',
        },
        {
          name: '_hjSessionUser_1',
          domain: '.example.com',
          path: '/',
          expires: Date.now() / 1000 + 86_400,
          httpOnly: false,
          secure: true,
          sameSite: 'None',
        },
      ],
    });

    const violations = await trackerLeakRule.evaluate(context);
    expect(violations).toHaveLength(2);
    expect(violations.every((item) => item.severity === 'CRITICAL')).toBe(true);
    expect(violations.map((item) => item.evidence.cookieName)).toEqual([
      '_ga',
      '_hjSessionUser_1',
    ]);
  });
});

describe('googleFontsRule', () => {
  it('returns HIGH violations for fonts.googleapis.com', async () => {
    const context = emptyContext({
      requests: [
        capturedRequest({
          url: 'https://fonts.googleapis.com/css2?family=Inter',
          domain: 'fonts.googleapis.com',
          country: 'US',
          isNonEU: true,
        }),
      ],
    });

    const violations = await googleFontsRule.evaluate(context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('HIGH');
    expect(violations[0]?.message).toMatch(/German courts/i);
  });

  it('flags non-EU requests lacking DPF/SCC annotations once per domain', async () => {
    const context = emptyContext({
      requests: [
        capturedRequest({
          url: 'https://cdn.us-vendor.test/a.js',
          domain: 'cdn.us-vendor.test',
          country: 'US',
          isNonEU: true,
        }),
        capturedRequest({
          url: 'https://cdn.us-vendor.test/b.js',
          domain: 'cdn.us-vendor.test',
          country: 'US',
          isNonEU: true,
        }),
      ],
    });

    const violations = await googleFontsRule.evaluate(context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('HIGH');
    expect(violations[0]?.message).toMatch(/Data Privacy Framework|SCC/i);
  });
});

describe('bannerCheckRule', () => {
  it('flags missing banners as CRITICAL when third-party activity exists', async () => {
    const context = emptyContext({
      requests: [thirdPartyRequest()],
      bannerFound: false,
      hasRejectButton: false,
    });

    const violations = await bannerCheckRule.evaluate(context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('CRITICAL');
  });

  it('flags consent banners without a first-layer Reject control', async () => {
    const context = emptyContext({
      requests: [thirdPartyRequest()],
      bannerFound: true,
      hasRejectButton: false,
    });

    const violations = await bannerCheckRule.evaluate(context);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe('MEDIUM');
  });

  it('passes when Ablehnen is present on the first layer', async () => {
    const context = emptyContext({
      requests: [thirdPartyRequest()],
      bannerFound: true,
      hasRejectButton: true,
    });

    await expect(bannerCheckRule.evaluate(context)).resolves.toEqual([]);
  });

  it('skips banner checks when no third-party activity is present', async () => {
    const context = emptyContext({
      bannerFound: false,
      hasRejectButton: false,
    });

    await expect(bannerCheckRule.evaluate(context)).resolves.toEqual([]);
  });

  it('keeps the DOM reject heuristic for offline analysis', () => {
    expect(
      hasFirstLayerReject(
        '<div id="cookie-banner"><button>Ablehnen</button><button>Akzeptieren</button></div>',
      ),
    ).toBe(true);
    expect(
      hasFirstLayerReject(
        '<div id="cookie-banner"><button>Accept All</button><a href="/settings">Settings</a></div>',
      ),
    ).toBe(false);
  });
});

describe('runRules', () => {
  it('isolates failing rules and still scores successful findings', async () => {
    const exploding = {
      id: 'boom',
      name: 'Boom',
      description: 'throws',
      category: 'TRACKING_CONSENT' as const,
      evaluate: vi.fn(async () => {
        throw new Error('rule crashed');
      }),
    };

    const result = await runRules(
      emptyContext({
        requests: [
          capturedRequest({
            url: 'https://fonts.gstatic.com/s/font.woff2',
            domain: 'fonts.gstatic.com',
            isNonEU: true,
          }),
        ],
      }),
      [exploding, googleFontsRule],
    );

    expect(result.ruleErrors).toHaveLength(1);
    expect(result.violations).toHaveLength(1);
    expect(result.score).toBe(100 - SEVERITY_PENALTIES.HIGH);
    expect(result.status).toBe('COMPLIANT');
    expect(result.metrics.nonEuTransfers).toBe(1);
  });
});
