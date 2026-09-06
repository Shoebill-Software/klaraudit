import chalk from 'chalk';
import Table from 'cli-table3';
import { DEFAULT_RULES, SEVERITY_PENALTIES } from '../rules/rule-engine.js';
import type {
  AuditResult,
  ComplianceStatus,
  MetricData,
  Severity,
  Violation,
} from '../types/index.js';
import { ciGateReasons, failsCiGate } from './ci.js';

const HEADER_WIDTH = 72;

export function formatTerminalReport(result: AuditResult): string {
  const sections = [
    renderHeader(result),
    renderSummary(result.metrics),
    renderViolations(result.violations),
    renderCiGate(result),
  ];
  return sections.join('\n');
}

export function renderTerminalReport(result: AuditResult): void {
  process.stdout.write(`${formatTerminalReport(result)}\n`);
}

/** @deprecated Prefer {@link renderTerminalReport}. */
export function printTerminalReport(result: AuditResult): void {
  renderTerminalReport(result);
}

function renderHeader(result: AuditResult): string {
  const title = 'KLARAUDIT';
  const subtitle = 'EU Privacy & GDPR Compliance Scanner';
  const inner = HEADER_WIDTH - 2;
  const divider = `+${'-'.repeat(inner)}+`;
  const scoreLabel = colorizeScore(result.score, result.status);
  const badge = complianceBadge(result.status);
  const timestamp = formatScanDate(result.scanDate);

  return [
    divider,
    `|${center(title, inner)}|`,
    `|${center(subtitle, inner)}|`,
    divider,
    headerRow('URL', result.targetUrl, inner),
    headerRow('Timestamp', timestamp, inner),
    headerRow('Score', `${scoreLabel} / 100`, inner, visibleLength(`${result.score} / 100`)),
    headerRow('Status', badge, inner, visibleLength(result.status)),
    divider,
  ].join('\n');
}

function headerRow(
  label: string,
  value: string,
  innerWidth: number,
  valueVisibleLength?: number,
): string {
  const prefix = ` ${label.padEnd(11)}: `;
  const valueLen = valueVisibleLength ?? visibleLength(value);
  const used = prefix.length + valueLen;
  const pad = Math.max(0, innerWidth - used);
  return `|${prefix}${value}${' '.repeat(pad)}|`;
}

function renderSummary(metrics: MetricData): string {
  const table = new Table({
    head: [chalk.bold('Stat'), chalk.bold('Value')],
    colWidths: [36, 24],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  table.push(
    ['Total Requests', String(metrics.totalRequests)],
    ['Cookies', String(metrics.totalCookies)],
    ['Third-Party Requests', String(metrics.thirdPartyRequests)],
    ['Non-EU Transfers', String(metrics.nonEuTransfers)],
  );

  return `\n${chalk.bold('Summary')}\n${table.toString()}\n`;
}

function renderViolations(violations: readonly Violation[]): string {
  const heading = chalk.bold('Violations');
  if (violations.length === 0) {
    return `${heading}\n  ${chalk.green('No violations detected.')}\n`;
  }

  const table = new Table({
    head: [
      chalk.bold('Severity'),
      chalk.bold('Category'),
      chalk.bold('Title'),
      chalk.bold('Deduction'),
      chalk.bold('Remediation'),
    ],
    wordWrap: true,
    wrapOnWordBoundary: true,
    colWidths: [12, 24, 30, 12, 34],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const violation of violations) {
    const penalty = SEVERITY_PENALTIES[violation.severity] ?? 0;
    table.push([
      colorizeSeverity(violation.severity),
      categoryForViolation(violation),
      violation.message,
      penalty === 0 ? chalk.gray('0') : chalk.red.bold(`-${penalty}`),
      violation.recommendation,
    ]);
  }

  return `${heading}\n${table.toString()}\n`;
}

function renderCiGate(result: AuditResult): string {
  const inner = HEADER_WIDTH - 2;
  const divider = `+${'-'.repeat(inner)}+`;

  if (!failsCiGate(result)) {
    const line = `  ${chalk.green.bold('CI gate: PASS')} — site meets the compliance threshold.`;
    return `${divider}\n${line}\n${divider}`;
  }

  const reasons = ciGateReasons(result).join('; ');
  const line = `  ${chalk.red.bold('CI gate: FAIL')} — ${reasons}.`;
  return `${divider}\n${line}\n${divider}`;
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

function complianceBadge(status: ComplianceStatus): string {
  switch (status) {
    case 'COMPLIANT':
      return chalk.green.bold(status);
    case 'WARNING':
      return chalk.yellow.bold(status);
    case 'NON_COMPLIANT':
      return chalk.red.bold(status);
  }
}

function colorizeScore(score: number, status: ComplianceStatus): string {
  const label = String(score);
  switch (status) {
    case 'COMPLIANT':
      return chalk.green.bold(label);
    case 'WARNING':
      return chalk.yellow.bold(label);
    case 'NON_COMPLIANT':
      return chalk.red.bold(label);
  }
}

function colorizeSeverity(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.bgRed.white.bold(severity);
    case 'HIGH':
      return chalk.red.bold(severity);
    case 'MEDIUM':
      return chalk.yellow.bold(severity);
    case 'LOW':
      return chalk.blue(severity);
    case 'INFO':
      return chalk.gray(severity);
  }
}

function formatScanDate(scanDate: string): string {
  const parsed = new Date(scanDate);
  if (Number.isNaN(parsed.getTime())) {
    return scanDate;
  }
  return parsed.toISOString();
}

function center(text: string, width: number): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const totalPad = width - text.length;
  const left = Math.floor(totalPad / 2);
  const right = totalPad - left;
  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

function visibleLength(value: string): number {
  return value.replace(/\u001B\[[0-9;]*m/g, '').length;
}
