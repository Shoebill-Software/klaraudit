# KlarAudit Specification

## Overview
A zero-cloud, headless CLI and container tool that scans websites from an external perspective to detect EU GDPR, e-Privacy, and Schrems II compliance violations.

## CLI Interface
- `klaraudit scan <url>`
  - `--ci`: Exits with status code 1 if any CRITICAL or HIGH severity violation is found.
  - `--format <format>`: Output format (`table`, `json`, `pdf`). Default is `table`.
  - `--output <path>`: Destination path when exporting to PDF or JSON.
  - `--timeout <ms>`: Page load timeout in milliseconds (default: 30000).

## Core Data Structures

```typescript
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Violation {
  id: string;
  ruleName: string;
  severity: Severity;
  message: string;
  evidence: {
    url?: string;
    domain?: string;
    cookieName?: string;
    elementSelector?: string;
    ipCountry?: string;
  };
  recommendation: string;
}

export interface MetricData {
  totalRequests: number;
  thirdPartyRequests: number;
  cookiesSetBeforeConsent: number;
  hasRejectButton: boolean;
  mandatoryPagesFound: boolean;
}

export interface AuditResult {
  targetUrl: string;
  scanDate: string;
  score: number;
  violations: Violation[];
  metrics: MetricData;
}
```

## Scoring

Base score: **100**. Deductions are applied per incident, then the result is floored at **0**.

| Severity | Typical finding | Penalty |
|----------|-----------------|---------|
| CRITICAL | Tracker fired before consent | −30 per incident (capped at −60 total) |
| HIGH | US IP leak / Google Fonts dynamic load | −15 per incident |
| MEDIUM | Dark pattern / buried reject button | −10 per incident |
| LOW | Missing security headers (HSTS/CSP) | −5 per incident |
| INFO | Informational only | 0 |

`score = max(0, 100 − criticalPenalty − highPenalty − mediumPenalty − lowPenalty)` where `criticalPenalty = min(CRITICAL_count × 30, 60)`.