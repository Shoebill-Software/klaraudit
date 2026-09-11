<div align="center">

# KlarAudit 🛡️

[![CI Status](https://github.com/Shoebill-Software/klaraudit/actions/workflows/ci.yml/badge.svg)](https://github.com/Shoebill-Software/klaraudit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/klaraudit.svg)](https://www.npmjs.com/package/klaraudit)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/Shoebill-Software/klaraudit/pkgs/container/klaraudit)

**Zero-cloud, headless GDPR, e-Privacy, and Schrems II compliance scanner.**  
Audit a live page the way an automated EU regulator scan would: locally, with no cloud account and no telemetry.

[Quick Start](#-quick-start) · [CLI Usage](#-cli-usage--options) · [Heuristics](#-compliance-heuristics) · [CI/CD](#-cicd-integration)

</div>

---

## Value proposition

European warning letters and fines are increasingly triggered by **external automated scans**, not by a lawyer reading your privacy policy. Marketing stacks routinely inject Google Tag Manager, Meta Pixel, or dynamically loaded Google Fonts that fire **before** the visitor consents, leaking IP addresses to US processors and creating **Schrems II** transfer liability.

Most “compliance” products ask you to drop another tracker, open a cloud account, or pay a monthly seat. **KlarAudit does none of that.**

It boots local headless Chromium, intercepts the first-paint network, cookies, and consent UI **before any click**, resolves remote IPs with an **offline GeoIP database**, and prints a scored report (terminal, JSON, or A4 PDF). Free and open source under MIT.

KlarAudit is a **technical audit tool**. It does not constitute legal advice.

---

## 🚀 Quick start

### Docker (recommended — Chromium included)

```bash
docker run --rm --init --ipc=host ghcr.io/shoebill-software/klaraudit scan https://your-site.com
```

### npx (Node.js 20+)

`playwright-core` does not download a browser by itself. Install Chromium once, then scan:

```bash
npx playwright-core@1.63.0 install chromium
npx klaraudit scan https://your-site.com
```

Machine-readable JSON (CI, scripts, or piping into other tools):

```bash
npx klaraudit scan https://your-site.com --format json
```

If Google Chrome is already installed, KlarAudit will try the system Chrome channel automatically.

### Sample findings

Findings name the vendor or hosting edge, include evidence (URL, IP, GeoIP), and give a concrete fix. Example excerpts:

| Severity | Category | Finding |
|----------|----------|---------|
| CRITICAL | TRACKING_CONSENT | Google Tag Manager (`googletagmanager.com`) loaded on first paint before any consent click |
| HIGH | CROSS_BORDER_TRANSFER | Google Fonts from `fonts.googleapis.com` resolved to a US IP — or your own origin resolved to a non-EU CDN edge (e.g. Vercel) |
| MEDIUM | BANNER_DARK_PATTERN | Consent UI found, but no equal-prominence Reject / Ablehnen while third-party hosts are active |
| LOW | MANDATORY_PAGES | `/impressum` missing or not HTTP 200 (status included in evidence) |

JSON shape (abridged):

```json
{
  "score": 45,
  "status": "NON_COMPLIANT",
  "violations": [
    {
      "severity": "CRITICAL",
      "message": "Google Tag Manager (www.googletagmanager.com) loaded on first paint before any consent click.",
      "evidence": {
        "url": "https://www.googletagmanager.com/gtag/js?id=G-XXXX",
        "domain": "www.googletagmanager.com",
        "detail": "Google Tag Manager request observed before consent",
        "ipCountry": "US"
      },
      "recommendation": "Load GTM only after opt-in (Consent Mode / CMP gate), or remove it from the first paint."
    }
  ]
}
```

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
npx klaraudit scan https://your-site.com --format json
npx klaraudit scan https://staging.example.com --ci --format json
npx klaraudit scan https://example.com --format pdf --output ./klaraudit-report.pdf
npx klaraudit scan https://example.com --timeout 30000
```

---

## ⚖️ Compliance heuristics

Base score is **100**. Deductions apply per incident, then the result is floored at **0**.

`CRITICAL` penalties are capped at **−60** total so a single broken banner plus several trackers cannot double-count the same first-paint failure into a meaningless zero without still failing the gate.

| Category | Typical severity | Deduction | Criteria |
|----------|------------------|-----------|----------|
| **Tracking Consent** | `CRITICAL` | **−30** per incident (capped at **−60** total for all `CRITICAL`) | Known trackers (GTM / `googletagmanager.com`, Google Analytics, Meta/`facebook.net`, DoubleClick, Hotjar, TikTok, Clarity, …) or non-essential tracking cookies fire during the interaction-free load, before any consent click. Missing first-layer banner while third-party activity is present is also `CRITICAL`. |
| **Cross-Border Transfer** | `HIGH` | **−15** per unique non-EU asset | Outbound requests resolved **outside the EU/EEA** via local `geoip-lite`. Distinguishes **Google Fonts**, **third-party hosts**, and **first-party CDN/hosting edges** (e.g. Vercel edge in CA/US). Evidence includes IP + country when available. |
| **Banner Dark Patterns** | `MEDIUM` | **−10** per incident | Consent UI detected, but no equal-prominence **Reject / Ablehnen** (or equivalent) control on the **first layer**. Accept-only, settings-only, or visually buried refusal paths fail this check. |
| **Mandatory Pages** | `LOW` | **−5** per missing page | `/impressum` or `/imprint`, and `/datenschutz` or `/privacy`, must return HTTP **200**. |

Severity order: `CRITICAL` > `HIGH` > `MEDIUM` > `LOW` (`INFO` is recorded with **0** deduction).

### Score bands

| Status | Score | Meaning |
|--------|-------|---------|
| **COMPLIANT** | **≥ 85** | No blocking first-paint leaks at the heuristic bar; still review residual `LOW`/`MEDIUM` findings. |
| **WARNING** | **60–84** | Issues present; not a clean pass. Fix before treating the page as regulator-safe. |
| **NON_COMPLIANT** | **< 60** | Likely to fail an automated external scan. `--ci` exits `1`. |

`--ci` also exits `1` on any `CRITICAL` or `HIGH` finding, even if the numeric score is still in `WARNING`.

---

## 🔁 CI/CD integration

Use the published image and set repository variable `KLARAUDIT_STAGING_URL` (for example `https://staging.example.com`):

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
          ghcr.io/shoebill-software/klaraudit
          scan "$TARGET_URL"
          --ci
          --format json
```

`npx` equivalent (after `npx playwright-core@1.63.0 install chromium`):

```bash
npx --yes klaraudit scan "$TARGET_URL" --ci --format json
```

---

## 📦 Publishing (maintainers)

Releases are cut from git tags matching `package.json` (for example `v0.1.0`):

1. Add repository secret `NPM_TOKEN` (npm automation token with publish rights).
2. Push tag `v0.1.0` — the Release workflow publishes to npm and `ghcr.io/shoebill-software/klaraudit`.
3. Make the GHCR package public under GitHub → Packages if the first push is private.

---

## Attribution & license

MIT License. Built by **[Shoebill Software](https://www.shoebill-software.de/)**.
