#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { scanPage } from './engine/scanner.js';
import {
  ciGateReasons,
  defaultPdfOutputPath,
  failsCiGate,
  generatePdfReport,
  renderTerminalReport,
} from './reporters/index.js';
import { runAudit } from './rules/rule-engine.js';
import type { AuditResult } from './types/index.js';

export { runAudit } from './rules/rule-engine.js';

/** Default page-load timeout (ms) for the CLI. */
const DEFAULT_TIMEOUT_MS = 15_000;

export type OutputFormat = 'terminal' | 'pdf' | 'json';

export interface ScanOptions {
  ci: boolean;
  format: OutputFormat;
  output?: string;
  timeout: string;
}

function readPackageVersion(): string {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
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
    // Fall back when package.json is unavailable.
  }
  return '0.1.0';
}

const program = new Command();

program
  .name('klaraudit')
  .description(
    'Zero-cloud headless CLI scanner for EU GDPR, e-Privacy, and Schrems II compliance',
  )
  .version(readPackageVersion());

program
  .command('scan')
  .description('Scan a URL for EU privacy and GDPR compliance violations')
  .argument('<url>', 'Target URL to audit')
  .option(
    '--ci',
    'Exit with code 1 if status is NON_COMPLIANT or any CRITICAL/HIGH violation is present',
    false,
  )
  .option(
    '--format <type>',
    'Output format: terminal, pdf, or json (default: terminal)',
    'terminal',
  )
  .option('--output <path>', 'Destination path for PDF/JSON reports')
  .option('--timeout <ms>', 'Page load timeout in ms', String(DEFAULT_TIMEOUT_MS))
  .action(async (url: string, options: ScanOptions) => {
    await runScanCommand(url, options);
  });

export async function runScanCommand(url: string, options: ScanOptions): Promise<void> {
  const format = options.format.toLowerCase() as OutputFormat;
  const allowedFormats: OutputFormat[] = ['terminal', 'pdf', 'json'];

  if (!allowedFormats.includes(format)) {
    console.error(
      chalk.red(
        `Invalid --format "${options.format}". Expected one of: ${allowedFormats.join(', ')}`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const timeoutMs = Number.parseInt(options.timeout, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    console.error(
      chalk.red(`Invalid --timeout "${options.timeout}". Expected a positive integer (ms).`),
    );
    process.exitCode = 1;
    return;
  }

  let targetUrl: string;
  try {
    targetUrl = normalizeAndValidateUrl(url);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(message));
    process.exitCode = 1;
    return;
  }

  const spinner = options.ci ? null : ora(`Scanning ${targetUrl}`).start();

  try {
    const context = await scanPage(targetUrl, timeoutMs);
    if (spinner) {
      spinner.text = `Evaluating rules for ${targetUrl}`;
    }
    const result = await runAudit(context);

    spinner?.succeed(chalk.green(`Scan complete · score ${result.score}/100`));

    await emitReport(result, format, options.output, options.ci);

    if (options.ci) {
      applyCiExit(result);
    }
  } catch (error: unknown) {
    spinner?.fail(chalk.red('Scan failed'));
    throw error;
  }
}

/**
 * Prepends `https://` when a scheme is missing, then validates http(s) URLs.
 */
export function normalizeAndValidateUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Unsupported URL protocol "${parsed.protocol}". Expected http: or https:`,
    );
  }

  return parsed.href;
}

/**
 * `--ci` gate: exit 1 when status is NON_COMPLIANT or any CRITICAL/HIGH violation exists.
 */
export function applyCiExit(result: AuditResult): void {
  if (!failsCiGate(result)) {
    console.error(chalk.green('KlarAudit CI passed.'));
    return;
  }

  const reasons = ciGateReasons(result);
  console.error(chalk.red(`KlarAudit CI failed: ${reasons.join('; ')}.`));
  process.exit(1);
}

async function emitReport(
  result: AuditResult,
  format: OutputFormat,
  outputPath: string | undefined,
  ci: boolean,
): Promise<void> {
  switch (format) {
    case 'terminal':
      renderTerminalReport(result);
      return;
    case 'json': {
      const payload = `${JSON.stringify(result, null, 2)}\n`;
      if (outputPath) {
        await writeFile(outputPath, payload, 'utf8');
        console.log(chalk.cyan(`JSON report written to ${outputPath}`));
      } else {
        process.stdout.write(payload);
      }
      return;
    }
    case 'pdf': {
      const destination = outputPath ?? defaultPdfOutputPath();
      const spinner = ci ? null : ora('Rendering PDF report').start();
      try {
        const writtenPath = await generatePdfReport(result, destination);
        spinner?.succeed(chalk.green(`PDF report written to ${writtenPath}`));
        if (!spinner) {
          console.log(chalk.cyan(`PDF report written to ${writtenPath}`));
        }
      } catch (error: unknown) {
        spinner?.fail(chalk.red('PDF rendering failed'));
        throw error;
      }
    }
  }
}

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`KlarAudit failed: ${message}`));
  process.exitCode = 1;
});
