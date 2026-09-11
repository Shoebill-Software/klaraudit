import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditResult } from '../types/index.js';
import { defaultPdfOutputPath, generatePdfReport, renderPdfHtml } from './pdf.js';

vi.mock('playwright-core', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

function sampleResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    targetUrl: 'https://shop.example/<audit>',
    scanDate: '2026-09-06T15:00:00.000Z',
    score: 40,
    status: 'NON_COMPLIANT',
    violations: [
      {
        id: 'tracker-leak-ga',
        ruleName: 'Tracker Leak',
        severity: 'CRITICAL',
        message: 'Tracker fired before consent.',
        evidence: {
          url: 'https://www.google-analytics.com/g/collect',
          domain: 'www.google-analytics.com',
          cookieName: '_ga',
          ipCountry: 'US',
        },
        recommendation: 'Load analytics only after opt-in.',
      },
    ],
    metrics: {
      totalRequests: 8,
      thirdPartyRequests: 3,
      cookiesSetBeforeConsent: 1,
      hasRejectButton: false,
      mandatoryPagesFound: false,
      totalCookies: 2,
      nonEuTransfers: 3,
    },
    ...overrides,
  };
}

describe('renderPdfHtml', () => {
  it('renders an agency A4 report with branding, status pill, score card, metrics, and escaped text', () => {
    const html = renderPdfHtml(sampleResult());

    expect(html).toContain('cdn.tailwindcss.com');
    expect(html).toContain('@page {');
    expect(html).toContain('size: A4;');
    expect(html).toContain('margin: 15mm;');
    expect(html).toContain('-webkit-print-color-adjust: exact');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('KlarAudit Compliance Report');
    expect(html).toContain('NON_COMPLIANT');
    expect(html).toContain('text-red-600');
    expect(html).toContain('bg-red-700 text-white border-red-800');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('TRACKING_CONSENT');
    expect(html).toContain('Tracker Leak');
    expect(html).toContain('Load analytics only after opt-in.');
    expect(html).toContain('shop.example');
    expect(html).toContain('&lt;audit&gt;');
    expect(html).not.toContain('https://shop.example/<audit>');
    expect(html).toContain('Total Requests');
    expect(html).toContain('Pre-Consent Cookies');
    expect(html).toContain('Third-Party Trackers');
    expect(html).toContain('Non-EU Data Transfers');
    expect(html).toContain('−30');
    expect(html).toContain('https://www.google-analytics.com/g/collect');
    expect(html).toContain('technical assessment from an external regulator');
    expect(html).toContain('does not replace formal legal counsel');
    expect(html).toContain('Directive 2002/58/EC');
    expect(html).toContain('GDPR Article 5(3)');
    expect(html).toContain('Schrems II');
    expect(html).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('shows COMPLIANT and WARNING status pills with matching score colors', () => {
    const compliant = renderPdfHtml(sampleResult({ score: 85, status: 'COMPLIANT', violations: [] }));
    expect(compliant).toContain('COMPLIANT');
    expect(compliant).toContain('text-emerald-600');
    expect(compliant).toContain('border-emerald-300 bg-emerald-50 text-emerald-800');

    const warning = renderPdfHtml(sampleResult({ score: 60, status: 'WARNING', violations: [] }));
    expect(warning).toContain('WARNING');
    expect(warning).toContain('text-amber-500');
    expect(warning).toContain('border-amber-300 bg-amber-50 text-amber-800');
  });

  it('shows an empty-state banner when there are no violations', () => {
    const html = renderPdfHtml(sampleResult({ score: 100, status: 'COMPLIANT', violations: [] }));
    expect(html).toContain('No violations were detected');
    expect(html).not.toContain('class="finding-block');
    expect(html).not.toContain('Tracker Leak');
  });
});

describe('defaultPdfOutputPath', () => {
  it('builds a timestamped A4 report filename', () => {
    expect(defaultPdfOutputPath(new Date('2026-09-06T15:00:00.000Z'))).toBe(
      './klaraudit-report-2026-09-06T15-00-00-000Z.pdf',
    );
  });
});

describe('generatePdfReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles HTML to PDF via Playwright setContent, fonts.ready, and page.pdf', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 mock');
    const page = {
      setContent: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      pdf: vi.fn(async (options: { path: string }) => {
        await writeFile(options.path, pdfBytes);
        return pdfBytes;
      }),
    };
    const browser = {
      newPage: vi.fn(async () => page as unknown as Page),
      close: vi.fn(async () => undefined),
    } as unknown as Browser;
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    const dir = await mkdtemp(join(tmpdir(), 'klaraudit-pdf-'));
    const outputPath = join(dir, 'report.pdf');
    const written = await generatePdfReport(sampleResult(), outputPath);

    expect(written).toBe(resolve(outputPath));
    expect(chromium.launch).toHaveBeenCalledWith({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    expect(page.setContent).toHaveBeenCalledOnce();
    const [html, setContentOptions] = vi.mocked(page.setContent).mock.calls[0] ?? [];
    expect(html).toContain('KlarAudit Compliance Report');
    expect(setContentOptions).toEqual({ waitUntil: 'networkidle' });
    expect(page.evaluate).toHaveBeenCalledWith('document.fonts.ready');
    expect(page.pdf).toHaveBeenCalledWith({
      path: resolve(outputPath),
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('closes the browser when PDF generation fails', async () => {
    const page = {
      setContent: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => undefined),
      pdf: vi.fn(async () => {
        throw new Error('pdf failed');
      }),
    };
    const browser = {
      newPage: vi.fn(async () => page as unknown as Page),
      close: vi.fn(async () => undefined),
    } as unknown as Browser;
    vi.mocked(chromium.launch).mockResolvedValue(browser);

    await expect(
      generatePdfReport(sampleResult(), join(tmpdir(), 'klaraudit-fail.pdf')),
    ).rejects.toThrow('pdf failed');
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
