/**
 * KlarAudit core domain types.
 * @see SPEC.md — single source of truth for report payloads.
 * Capture types (`Captured*`, `ScanContext`) are implied by the local scan pipeline.
 */

/** @see SPEC.md Core Data Structures */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/** Overall compliance band derived from the composite score. */
export type ComplianceStatus = 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';

/** Heuristic category for compliance rule grouping. */
export type RuleCategory =
  | 'TRACKING_CONSENT'
  | 'CROSS_BORDER_TRANSFER'
  | 'BANNER_DARK_PATTERN'
  | 'MANDATORY_PAGES';

/** @see SPEC.md Core Data Structures */
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

/** @see SPEC.md Core Data Structures */
export interface MetricData {
  totalRequests: number;
  thirdPartyRequests: number;
  cookiesSetBeforeConsent: number;
  hasRejectButton: boolean;
  mandatoryPagesFound: boolean;
  /** Total cookies observed during the interaction-free load. */
  totalCookies: number;
  /** Distinct outbound requests resolved outside the EU/EEA. */
  nonEuTransfers: number;
}

/** @see SPEC.md Core Data Structures */
export interface AuditResult {
  targetUrl: string;
  scanDate: string;
  score: number;
  status: ComplianceStatus;
  violations: Violation[];
  metrics: MetricData;
}

/** Network artifact captured during the pre-consent page load. */
export interface CapturedRequest {
  url: string;
  domain: string;
  method: string;
  status: number;
  ip?: string;
  country?: string;
  isNonEU: boolean;
}

/** Cookie observed during the interaction-free initial load. */
export interface CapturedCookie {
  name: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

/** Reachability probe for a mandatory legal disclosure page. */
export interface MandatoryPageCheck {
  found: boolean;
  status: number;
  url?: string;
}

/**
 * Local scan snapshot passed to compliance rules.
 * Produced by the headless engine; never persisted to cloud state.
 */
export interface ScanContext {
  targetUrl: string;
  startTime: Date;
  endTime?: Date;
  requests: CapturedRequest[];
  cookies: CapturedCookie[];
  bannerFound: boolean;
  hasRejectButton: boolean;
  mandatoryPages: {
    impressum: MandatoryPageCheck;
    datenschutz: MandatoryPageCheck;
  };
}

/**
 * Contract for all compliance rules. Implementations live under `src/rules/`.
 * A failure in one rule must be isolated by the runner and never abort the audit.
 */
export interface ComplianceRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: RuleCategory;
  evaluate(context: ScanContext): Promise<Violation[]>;
}
