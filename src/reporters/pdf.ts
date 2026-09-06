import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { chromium, type Browser } from 'playwright-core';
import { DEFAULT_RULES, SEVERITY_PENALTIES } from '../rules/rule-engine.js';
import type { AuditResult, ComplianceStatus, Severity, Violation } from '../types/index.js';

const PDF_LAUNCH_ARGS = ['--no-sandbox', '--disable-dev-shm-usage'] as const;
const SCORE_RING_RADIUS = 52;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

const __dirname = dirname(fileURLToPath(import.meta.url));

export function defaultPdfOutputPath(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `./klaraudit-report-${stamp}.pdf`;
}

interface PdfViolationView extends Violation {
  category: string;
  deduction: number;
  resource: string;
}

interface PdfSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

interface PdfReportContext {
  targetUrl: string;
  scanDate: string;
  score: number;
  status: ComplianceStatus;
  violations: PdfViolationView[];
  metrics: AuditResult['metrics'];
  severityCounts: PdfSeverityCounts;
  scoreDashOffset: string;
  engineVersion: string;
  generatedAt: string;
}

let compiledTemplate: Handlebars.TemplateDelegate<PdfReportContext> | undefined;
let helpersRegistered = false;

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
}

export function formatReportDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatUtcDate(value);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatUtcDate(parsed);
    }
    return value;
  }
  return '';
}

function formatUtcDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function registerPdfHelpers(instance: typeof Handlebars = Handlebars): void {
  instance.registerHelper('formatDate', (value: unknown): string => formatReportDate(value));

  instance.registerHelper('formatDeduction', (value: unknown): string => {
    const amount = toNumber(value);
    if (!Number.isFinite(amount) || amount === 0) {
      return '0';
    }
    return `−${amount}`;
  });

  instance.registerHelper('gte', (left: unknown, right: unknown): boolean => {
    return toNumber(left) >= toNumber(right);
  });

  instance.registerHelper('scoreColorClass', (score: unknown): string => {
    const value = toNumber(score);
    if (value >= 85) {
      return 'text-emerald-600';
    }
    if (value >= 60) {
      return 'text-amber-500';
    }
    return 'text-red-600';
  });

  instance.registerHelper('statusPillClass', (status: unknown): string => {
    switch (status as ComplianceStatus) {
      case 'COMPLIANT':
        return 'border-emerald-300 bg-emerald-50 text-emerald-800';
      case 'WARNING':
        return 'border-amber-300 bg-amber-50 text-amber-800';
      case 'NON_COMPLIANT':
        return 'border-red-300 bg-red-50 text-red-800';
      default:
        return 'border-slate-300 bg-slate-100 text-slate-700';
    }
  });

  instance.registerHelper('severityBadgeClass', (severity: unknown): string => {
    switch (severity as Severity) {
      case 'CRITICAL':
        return 'bg-red-700 text-white border-red-800';
      case 'HIGH':
        return 'bg-orange-600 text-white border-orange-700';
      case 'MEDIUM':
        return 'bg-amber-400 text-amber-950 border-amber-500';
      case 'LOW':
        return 'bg-sky-600 text-white border-sky-700';
      case 'INFO':
        return 'bg-slate-500 text-white border-slate-600';
      default:
        return 'bg-slate-400 text-white border-slate-500';
    }
  });
}

function resolveTemplatePath(): string {
  const candidates = [
    join(__dirname, 'templates', 'report.hbs'),
    join(__dirname, '..', '..', 'src', 'reporters', 'templates', 'report.hbs'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`KlarAudit PDF template not found. Looked in: ${candidates.join(', ')}`);
  }
  return match;
}

function readEngineVersion(): string {
  const pkgPath = join(__dirname, '..', '..', 'package.json');
  try {
    const parsed: unknown = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string'
    ) {
      return parsed.version;
    }
  } catch {
    // Fall back to the packaged default when package.json is unavailable.
  }
  return '0.1.0';
}

function categoryForViolation(violation: Violation): string {
  const matched = DEFAULT_RULES.find(
    (rule) =>
      violation.id === rule.id ||
      violation.id.startsWith(`${rule.id}-`) ||
      violation.ruleName === rule.name,
  );
  return matched?.category ?? 'UNCLASSIFIED';
}

function offendingResource(violation: Violation): string {
  const { url, domain, cookieName, elementSelector } = violation.evidence;
  return url ?? domain ?? cookieName ?? elementSelector ?? '—';
}

function countSeverities(violations: readonly Violation[]): PdfSeverityCounts {
  const counts: PdfSeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: violations.length,
  };

  for (const violation of violations) {
    switch (violation.severity) {
      case 'CRITICAL':
        counts.critical += 1;
        break;
      case 'HIGH':
        counts.high += 1;
        break;
      case 'MEDIUM':
        counts.medium += 1;
        break;
      case 'LOW':
        counts.low += 1;
        break;
      case 'INFO':
        counts.info += 1;
        break;
    }
  }

  return counts;
}

function scoreDashOffset(score: number): string {
  const clamped = Math.min(100, Math.max(0, score));
  return (SCORE_RING_CIRCUMFERENCE * (1 - clamped / 100)).toFixed(2);
}

function toContext(result: AuditResult): PdfReportContext {
  return {
    targetUrl: result.targetUrl,
    scanDate: result.scanDate,
    score: result.score,
    status: result.status,
    violations: result.violations.map((violation) => ({
      ...violation,
      category: categoryForViolation(violation),
      deduction: SEVERITY_PENALTIES[violation.severity] ?? 0,
      resource: offendingResource(violation),
    })),
    metrics: result.metrics,
    severityCounts: countSeverities(result.violations),
    scoreDashOffset: scoreDashOffset(result.score),
    engineVersion: readEngineVersion(),
    generatedAt: formatReportDate(new Date()),
  };
}

function getCompiledTemplate(): Handlebars.TemplateDelegate<PdfReportContext> {
  if (!helpersRegistered) {
    registerPdfHelpers();
    helpersRegistered = true;
  }
  if (!compiledTemplate) {
    const source = readFileSync(resolveTemplatePath(), 'utf8');
    compiledTemplate = Handlebars.compile<PdfReportContext>(source);
  }
  return compiledTemplate;
}

export function renderPdfHtml(result: AuditResult): string {
  return getCompiledTemplate()(toContext(result));
}

export async function generatePdfReport(result: AuditResult, outputPath: string): Promise<string> {
  const html = renderPdfHtml(result);
  const destination = resolve(outputPath);
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [...PDF_LAUNCH_ARGS],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate('document.fonts.ready');
    await page.pdf({
      path: destination,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
  } finally {
    await browser?.close();
  }

  return destination;
}
