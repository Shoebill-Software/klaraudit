<div align="center">

# KlarAudit 🛡️

[![CI Status](https://github.com/fenneq-software/klaraudit/actions/workflows/ci.yml/badge.svg)](https://github.com/fenneq-software/klaraudit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/klaraudit.svg)](https://www.npmjs.com/package/klaraudit)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/fenneq-software/klaraudit/pkgs/container/klaraudit)

**Zero-cloud, headless GDPR, e-Privacy, and Schrems II compliance scanner.**  
Audit a live page the way an automated EU regulator scan would: locally, with no install and no telemetry.

[Quick Start](#-quick-start) · [CLI Usage](#-cli-usage--options) · [Heuristics](#-compliance-heuristics) · [CI/CD](#-cicd-integration)

</div>

---

## Value proposition

European warning letters and fines are increasingly triggered by **external automated scans**, not by a lawyer reading your privacy policy. Marketing stacks routinely inject Google Tag Manager, Meta Pixel, or dynamically loaded Google Fonts that fire **before** the visitor consents, leaking IP addresses to US processors and creating **Schrems II** transfer liability.

Most “compliance” products ask you to drop another tracker, open a cloud account, or pay a monthly seat. **KlarAudit does none of that.**

It boots local headless Chromium, intercepts the first-paint network, cookies, and consent UI **before any click**, resolves remote IPs with an **offline GeoIP database**, and prints a scored report (terminal, JSON, or agency A4 PDF). Execution is zero-cloud and zero-install: `npx` or Docker on your machine or in CI.

KlarAudit is a **technical audit tool**. It does not constitute legal advice.

---

## 🚀 Quick start

Instant scan, no global install:

```bash
npx klaraudit scan https://your-site.com
```

Same scan in an ephemeral container:

```bash
docker run --rm ghcr.io/fenneq-software/klaraudit scan https://your-site.com
```

Requires Node.js 20+ for `npx`. The Docker image bundles Chromium.

---

## 🧰 CLI usage & options

```bash
klaraudit scan <url> [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Fail the process (exit code `1`) when status is `NON_COMPLIANT` **or** any `CRITICAL` / `HIGH` violation is present. stdout/stderr only, suitable as a merge gate. |
| `--format <terminal\|pdf\|json>` | Report format. Default: `terminal`. |
| `--output <path>` | Destination for `pdf` or `json` reports. PDF defaults to a timestamped file in the working directory if omitted. JSON writes to stdout when `--output` is omitted. |
| `--timeout <ms>` | Page-load timeout in milliseconds. Default: `15000`. |

Examples:

```bash
npx klaraudit scan https://staging.example.com --ci --format json
npx klaraudit scan https://client.example.com --format pdf --output ./handover/klaraudit-report.pdf
npx klaraudit scan https://example.com --timeout 30000
```

---

## ⚖️ Compliance heuristics

Base score is **100**. Deductions apply per incident, then the result is floored at **0**.

`CRITICAL` penalties are capped at **−60** total so a single broken banner plus several trackers cannot double-count the same first-paint failure into a meaningless zero without still failing the gate.

| Category | Typical severity | Deduction | Criteria |
|----------|------------------|-----------|----------|
| **Tracking Consent** | `CRITICAL` | **−30** per incident (capped at **−60** total for all `CRITICAL`) | Known trackers (GTM / `googletagmanager.com`, Google Analytics, Meta/`facebook.net`, DoubleClick, Hotjar, TikTok, Clarity, …) or non-essential tracking cookies fire during the interaction-free load, before any consent click. Missing first-layer banner while third-party activity is present is also `CRITICAL`. |
| **Cross-Border Transfer** | `HIGH` | **−15** per unique non-EU asset | Outbound font/script/stylesheet requests resolved **outside the EU/EEA** via local `geoip-lite` (no external GeoIP API). Dynamic Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) are always flagged: German courts have treated IP transfer to Google without consent as a GDPR violation. |
| **Banner Dark Patterns** | `MEDIUM` | **−10** per incident | Consent UI detected, but no equal-prominence **Reject / Ablehnen** (or equivalent) control on the **first layer**. Accept-only, settings-only, or visually buried refusal paths fail this check. |
| **Mandatory Pages** | `LOW` | **−5** per missing page | `/impressum` or `/imprint`, and `/datenschutz` or `/privacy`, must return HTTP **200**. |

Severity order: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW` (`INFO` is recorded with **0** deduction).

### Score bands

| Status | Score | Meaning |
|--------|-------|---------|
| **COMPLIANT** | **≥ 85** | No blocking first-paint leaks at the heuristic bar; still review residual `LOW`/`MEDIUM` findings. |
| **WARNING** | **60–84** | Issues present; not a clean handover. Fix before treating the page as regulator-safe. |
| **NON_COMPLIANT** | **< 60** | Likely to fail an automated external scan. `--ci` exits `1`. |

`--ci` also exits `1` on any `CRITICAL` or `HIGH` finding, even if the numeric score is still in `WARNING`.

---

## 🔁 CI/CD integration

Drop this workflow in `.github/workflows/compliance.yml` and set repository variable `KLARAUDIT_STAGING_URL` (for example `https://staging.example.com`).

```yaml
name: KlarAudit Compliance

on:
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  compliance:
    name: Scan staging URL
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      TARGET_URL: ${{ vars.KLARAUDIT_STAGING_URL }}
    steps:
      - name: Require staging URL
        run: |
          if [ -z "$TARGET_URL" ]; then
            echo "Set repository variable KLARAUDIT_STAGING_URL."
            exit 1
          fi

      - name: Run KlarAudit (CI gate)
        run: >
          docker run --rm --init --ipc=host
          ghcr.io/fenneq-software/klaraudit
          scan "$TARGET_URL"
          --ci
          --format json
```

`npx` equivalent (requires Chromium available to Playwright):

```bash
npx --yes klaraudit scan "$TARGET_URL" --ci --format json
```

---

## Attribution & license

MIT License. Built by **[Fenneq Software](https://github.com/fenneq-software)**.
