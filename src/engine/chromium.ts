import { chromium, type Browser, type LaunchOptions } from 'playwright-core';

/** Keep in sync with `playwright-core` in package.json. */
export const PLAYWRIGHT_CORE_VERSION = '1.63.0';

/** Chromium flags for Docker / unprivileged containers. */
export const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
] as const;

export function chromiumInstallHint(): string {
  return [
    'KlarAudit needs a Chromium browser. playwright-core does not download one automatically.',
    'Install Chromium for this Playwright version, then retry:',
    `  npx playwright-core@${PLAYWRIGHT_CORE_VERSION} install chromium`,
    'Or install Google Chrome and retry (KlarAudit falls back to the system Chrome channel).',
    'Or run the all-in-one image:',
    '  docker run --rm --init --ipc=host ghcr.io/shoebill-software/klaraudit scan <url>',
  ].join('\n');
}

/**
 * Launch headless Chromium via playwright-core, then fall back to system Chrome.
 */
export async function launchChromium(
  overrides: Omit<LaunchOptions, 'args'> & { args?: readonly string[] } = {},
): Promise<Browser> {
  const launchOptions: LaunchOptions = {
    headless: true,
    ...overrides,
    args: [...(overrides.args ?? CHROMIUM_LAUNCH_ARGS)],
  };

  try {
    return await chromium.launch(launchOptions);
  } catch (localError: unknown) {
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch {
      const detail =
        localError instanceof Error ? localError.message : String(localError);
      throw new Error(`${detail}\n\n${chromiumInstallHint()}`);
    }
  }
}
