export const languages = {
  en: 'EN',
  de: 'DE',
  es: 'ES',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const VERSION = '0.1.0';

export const githubUrl = 'https://github.com/Shoebill-Software/klaraudit';
export const licenseUrl = 'https://github.com/Shoebill-Software/klaraudit/blob/main/LICENSE';
export const companyUrl = 'https://www.shoebill-software.de/';
export const scanCommand = 'npx klaraudit scan https://example.com';

export const localePath: Record<Lang, string> = {
  en: '/',
  de: '/de/',
  es: '/es/',
};

export const ogLocale: Record<Lang, string> = {
  en: 'en_US',
  de: 'de_DE',
  es: 'es_ES',
};

const en = {
  meta: {
    title: 'KlarAudit: Audit your website before European regulators do',
    description:
      'Local CLI scanner for GDPR, ePrivacy, and Schrems II issues. Intercepts GTM, Meta Pixel, and Google Fonts before consent. Offline GeoIP. Deterministic CI exit codes. Built by Shoebill Software.',
    skip: 'Skip to content',
  },
  nav: {
    manifest: 'Manifest',
    scoring: 'Scoring',
    license: 'License',
    github: 'GitHub',
    lang: 'Language',
  },
  hero: {
    kicker: 'Local CLI. GDPR, ePrivacy, Schrems II.',
    headline: 'Audit your website before European regulators do.',
    subhead:
      'KlarAudit launches headless Chromium on your machine, records first-paint requests before any consent click, and scores the page against TTDSG / TDDDG § 25, GDPR Art. 6 and Art. 83, LG München 3 O 17493/20, and Schrems II. No cloud account. No telemetry. Exit code 1 on CRITICAL or HIGH findings.',
    commandLabel: 'Local inspection',
    copy: 'Copy',
    copied: 'Copied to clipboard.',
    copiedShort: 'Copied',
    copyFailed: 'Copy failed. Select the command manually.',
    cicd: 'CI/CD gate',
    source: 'Source on GitHub',
  },
  terminal: {
    eyebrow: 'Sample trace',
    title: 'What the CLI prints on a failing first paint',
    body: 'KlarAudit does not click Accept. It watches the idle load, resolves remote IPs with a local GeoIP database, then scores the page with actionable evidence (URL, IP, GeoIP, fix). The trace below matches a representative NON_COMPLIANT run.',
    windowTitle: 'klaraudit scan https://shop.example.de --ci',
    scanning: 'Scanning https://shop.example.de  timeout=15000ms',
    intercept: 'intercept network (pre-consent, no click)',
    targets: 'targets: cookies, scripts, fonts, banner DOM, /impressum, /datenschutz',
    gtm: 'FAIL  Google Tag Manager  googletagmanager.com  before consent',
    fonts: 'FAIL  Google Fonts  fonts.googleapis.com  142.250.185.196 · GeoIP US',
    banner: 'FAIL  Reject / Ablehnen missing  while hosts: googletagmanager.com',
    pages: 'OK    /impressum 200  /datenschutz 200',
    score: 'Score  45 / 100',
    status: 'Status NON_COMPLIANT  (threshold < 60)',
    ciFail: 'CI gate: FAIL  status is NON_COMPLIANT; CRITICAL or HIGH violations present.',
    exit: 'exit 1',
    colSeverity: 'Severity',
    colCategory: 'Category',
    colFinding: 'Finding',
    colDelta: 'Delta',
    colFix: 'Remediation',
    findings: [
      {
        severity: 'CRITICAL',
        category: 'TRACKING_CONSENT',
        finding:
          'Google Tag Manager (googletagmanager.com) loaded on first paint before any consent click',
        deduction: '-30',
        fix: 'Load GTM only after opt-in (Consent Mode / CMP gate).',
      },
      {
        severity: 'HIGH',
        category: 'CROSS_BORDER_TRANSFER',
        finding:
          'Google Fonts from fonts.googleapis.com resolved to IP 142.250.185.196 in US — visitor IP sent to Google before consent',
        deduction: '-15',
        fix: 'Self-host fonts or load Google Fonts only after consent.',
      },
      {
        severity: 'MEDIUM',
        category: 'BANNER_DARK_PATTERN',
        finding:
          'Consent UI found, but no equal-prominence Reject / Ablehnen while third-party hosts are active',
        deduction: '-10',
        fix: 'Place Ablehnen beside Accept at the same visual weight.',
      },
    ],
  },
  manifest: {
    eyebrow: 'Inspection Manifest',
    title: 'First-paint controls, in inspection order',
    lead: 'Sequential catalog of the checks a German or EU automated scan can trigger before a visitor interacts. Each row pairs the external regulator view with the local CLI finding.',
    doc: 'KLAR-IMF-01',
    scope: 'Scope: pre-consent first paint',
    engine: 'Engine: Playwright Chromium (local)',
    regulator: 'External Regulator Scan',
    cli: 'KlarAudit CLI Output',
    rows: [
      {
        index: '01',
        code: 'TRACKING_CONSENT',
        severity: 'CRITICAL',
        title: 'Pre-Consent Network Interception',
        body: 'Catches GTM, Meta Pixel, and other known trackers that fire before the user clicks consent. The runner hooks page requests before navigation and never clicks Accept.',
        refs: 'TTDSG / TDDDG § 25, GDPR Art. 6',
        regulator:
          'Warning-letter crawlers record googletagmanager.com and facebook.net on first paint. The visitor IP is already in a US processor log. Storage or access of information on the terminal equipment lacks a § 25 TDDDG basis.',
        cli: 'TRACKING_CONSENT  CRITICAL  -30\nGoogle Tag Manager (googletagmanager.com)\nloaded on first paint before consent\nevidence: gtag/js URL · GeoIP US',
      },
      {
        index: '02',
        code: 'CROSS_BORDER_TRANSFER',
        severity: 'HIGH',
        title: 'Dynamic Cross-Border IP Leaks',
        body: 'Detects Google Fonts, other non-EU third-party hosts, and first-party CDN/hosting edges (for example a Vercel edge outside the EU). Remote IPs are classified with an offline GeoIP database. The scanner does not call a cloud lookup API.',
        refs: 'LG München 3 O 17493/20, Schrems II',
        regulator:
          'LG München I held that loading Google Fonts from US servers without consent unlawfully transmits the visitor IP. Schrems II invalidated Privacy Shield. Unannotated US transfers remain an Art. 83 GDPR fine risk.',
        cli: 'CROSS_BORDER_TRANSFER  HIGH  -15\nGoogle Fonts fonts.googleapis.com\nIP 142.250.185.196 · GeoIP US\nSelf-host fonts or delay until consent',
      },
      {
        index: '03',
        code: 'BANNER_DARK_PATTERN',
        severity: 'MEDIUM',
        title: 'Consent Layer & Dark Patterns',
        body: 'Validates the first-layer DOM for a reject action with equal prominence to accept. When it fails, the report lists the third-party hosts or cookies that made a banner required. Settings-only paths and visually weaker refusal controls fail this check.',
        refs: 'EDPB Guidelines 03/2022',
        regulator:
          'EDPB Guidelines 03/2022 require a genuine choice. A prominent Accept next to a grey settings link is treated as a dark pattern. Equal-prominence Ablehnen is the German baseline.',
        cli: 'BANNER_DARK_PATTERN  MEDIUM  -10\nNo equal-prominence Reject / Ablehnen\nwhile hosts: googletagmanager.com',
      },
      {
        index: '04',
        code: 'CI_GATE',
        severity: 'GATE',
        title: 'Local Pipeline Gate & Offline Auditing',
        body: 'Runs entirely inside your runner or CLI. Zero cloud dependencies. Deterministic exit codes for CI/CD. Network capture, DOM heuristics, and GeoIP stay on the machine that launched the scan. Use --format json for machine-readable output.',
        refs: 'CI exit contract, GDPR Art. 32',
        regulator:
          'External scanners do not wait for a SaaS dashboard. They score the site as shipped. A merge that introduces a US font or a pre-consent pixel is visible on the next crawl.',
        cli: '--ci  exit 1\nstatus NON_COMPLIANT, or any CRITICAL/HIGH finding\nnpx klaraudit scan URL --format json',
      },
    ],
  },
  rules: {
    eyebrow: 'Scoring',
    title: 'Heuristic deductions and status bands',
    lead: 'Base score 100. Deductions apply per incident, then the result is floored at 0. CRITICAL deductions are capped at -60. These are technical heuristics, not a legal opinion.',
    colCategory: 'Category',
    colSeverity: 'Severity',
    colDeduction: 'Deduction',
    colCriteria: 'Criteria',
    items: [
      {
        category: 'Tracking Consent',
        severity: 'CRITICAL',
        deduction: '-30 / incident (CRITICAL total capped at -60)',
        criteria:
          'Named vendors (GTM, Google Analytics, Meta Pixel, DoubleClick, Hotjar, TikTok, Clarity) or tracking cookies fire on first paint. Findings include the request URL and a concrete fix. A missing first-layer banner while third-party activity is present is also CRITICAL.',
      },
      {
        category: 'Cross-Border Transfer',
        severity: 'HIGH',
        deduction: '-15 / unique non-EU asset',
        criteria:
          'Requests resolved outside the EU/EEA via local geoip-lite. Distinguishes Google Fonts, third-party hosts, and first-party CDN/hosting edges. Evidence includes IP and country when available.',
      },
      {
        category: 'Banner Dark Patterns',
        severity: 'MEDIUM',
        deduction: '-10 / incident',
        criteria:
          'A consent UI exists, but Reject / Ablehnen (or equivalent) is missing or weaker than Accept on the first layer. The report lists the third-party hosts/cookies that triggered the check.',
      },
      {
        category: 'Mandatory Pages',
        severity: 'LOW',
        deduction: '-5 / missing page',
        criteria:
          '/impressum or /imprint and /datenschutz or /privacy must return HTTP 200. Findings include the probed URL and status.',
      },
    ],
    bands: [
      {
        status: 'COMPLIANT',
        range: '>= 85',
        note: 'Heuristic bar cleared for first paint.',
      },
      {
        status: 'WARNING',
        range: '60-84',
        note: 'Issues remain. Review before treating the page as safe.',
      },
      {
        status: 'NON_COMPLIANT',
        range: '< 60',
        note: '--ci exits 1. Fix before launch.',
      },
    ],
  },
  pricing: {
    eyebrow: 'License',
    title: 'Free and open source under MIT',
    lead: 'KlarAudit is a portfolio project by Shoebill Software. The full CLI is free: local scans, CI gates, JSON, and A4 PDF reports. No account, no telemetry, no paid tier.',
    includes: [
      'MIT license — use, modify, and redistribute',
      'Terminal, JSON, and A4 PDF output',
      'Local npx or Docker with bundled Chromium',
      'Deterministic --ci exit codes for merge gates',
    ],
    ctaGithub: 'View source on GitHub',
    ctaNpm: 'npm package',
    commandsLabel: 'Run locally',
    npxCommand: 'npx klaraudit scan https://example.com',
    jsonCommand: 'npx klaraudit scan https://example.com --format json',
    footnote:
      'Findings are technical heuristics, not legal advice. For npx, install Chromium once with: npx playwright-core@1.63.0 install chromium — or use the Docker image, which already includes the browser.',
  },
  footer: {
    product: 'KlarAudit',
    blurb: 'Headless EU privacy scanner. Local execution only.',
    disclaimer:
      'KlarAudit is a technical inspection tool. Findings are heuristics, not legal advice, and do not replace qualified counsel. Administrative fines under Article 83 GDPR and German warning letters (Abmahnungen) depend on facts a first-paint scan cannot fully establish.',
    license: 'MIT License',
    builtBy: 'Built by Shoebill Software.',
  },
};

const de = {
  meta: {
    title: 'KlarAudit: Websites auf DSGVO- und ePrivacy-Verstöße prüfen',
    description:
      'Lokaler CLI-Scanner für DSGVO, ePrivacy und Schrems II. Fängt GTM, Meta Pixel und Google Fonts vor der Einwilligung ab. Offline-GeoIP. Deterministische CI-Exit-Codes. Entwickelt von Shoebill Software.',
    skip: 'Zum Inhalt springen',
  },
  nav: {
    manifest: 'Manifest',
    scoring: 'Bewertung',
    license: 'Lizenz',
    github: 'GitHub',
    lang: 'Sprache',
  },
  hero: {
    kicker: 'Lokales CLI. DSGVO, ePrivacy, Schrems II.',
    headline: 'Websites auf DSGVO- und ePrivacy-Verstöße prüfen, bevor Abmahnungen eintreffen.',
    subhead:
      'KlarAudit startet Headless-Chromium auf Ihrem Rechner, zeichnet First-Paint-Requests vor jedem Consent-Klick auf und bewertet die Seite anhand von TTDSG / TDDDG § 25, DSGVO Art. 6 und Art. 83, LG München 3 O 17493/20 sowie Schrems II. Kein Cloud-Konto. Keine Telemetrie. Exit-Code 1 bei CRITICAL- oder HIGH-Befunden.',
    commandLabel: 'Lokale Prüfung',
    copy: 'Kopieren',
    copied: 'In die Zwischenablage kopiert.',
    copiedShort: 'Kopiert',
    copyFailed: 'Kopieren fehlgeschlagen. Befehl manuell markieren.',
    cicd: 'CI/CD-Gate',
    source: 'Quellcode auf GitHub',
  },
  terminal: {
    eyebrow: 'Beispieltrace',
    title: 'CLI-Ausgabe bei einem durchgefallenen First Paint',
    body: 'KlarAudit klickt nicht auf Akzeptieren. Es beobachtet den unbelasteten Ladevorgang, löst Remote-IPs mit einer lokalen GeoIP-Datenbank auf und bewertet die Seite mit handlungsrelevanten Evidenzen (URL, IP, GeoIP, Fix). Der Trace entspricht einem repräsentativen NON_COMPLIANT-Lauf.',
    windowTitle: 'klaraudit scan https://shop.example.de --ci',
    scanning: 'Scanning https://shop.example.de  timeout=15000ms',
    intercept: 'intercept network (pre-consent, no click)',
    targets: 'targets: cookies, scripts, fonts, banner DOM, /impressum, /datenschutz',
    gtm: 'FAIL  Google Tag Manager  googletagmanager.com  vor Einwilligung',
    fonts: 'FAIL  Google Fonts  fonts.googleapis.com  142.250.185.196 · GeoIP US',
    banner: 'FAIL  Ablehnen fehlt  bei Hosts: googletagmanager.com',
    pages: 'OK    /impressum 200  /datenschutz 200',
    score: 'Score  45 / 100',
    status: 'Status NON_COMPLIANT  (Schwelle < 60)',
    ciFail: 'CI gate: FAIL  Status NON_COMPLIANT; CRITICAL- oder HIGH-Verstöße vorhanden.',
    exit: 'exit 1',
    colSeverity: 'Schwere',
    colCategory: 'Kategorie',
    colFinding: 'Befund',
    colDelta: 'Delta',
    colFix: 'Abhilfe',
    findings: [
      {
        severity: 'CRITICAL',
        category: 'TRACKING_CONSENT',
        finding:
          'Google Tag Manager (googletagmanager.com) wurde beim First Paint vor jedem Consent-Klick geladen',
        deduction: '-30',
        fix: 'GTM erst nach Opt-in laden (Consent Mode / CMP-Gate).',
      },
      {
        severity: 'HIGH',
        category: 'CROSS_BORDER_TRANSFER',
        finding:
          'Google Fonts von fonts.googleapis.com auf IP 142.250.185.196 in US aufgelöst — Besucher-IP vor Einwilligung an Google',
        deduction: '-15',
        fix: 'Schriften selbst hosten oder Google Fonts erst nach Consent laden.',
      },
      {
        severity: 'MEDIUM',
        category: 'BANNER_DARK_PATTERN',
        finding:
          'Consent-UI gefunden, aber kein gleichwertiges Ablehnen bei aktiver Drittanbieter-Aktivität',
        deduction: '-10',
        fix: 'Ablehnen neben Akzeptieren mit gleichem visuellem Gewicht platzieren.',
      },
    ],
  },
  manifest: {
    eyebrow: 'Prüfmanifest',
    title: 'First-Paint-Kontrollen, in Prüfreihenfolge',
    lead: 'Sequenzielle Liste der Prüfschritte, die ein automatisierter Scan in Deutschland oder der EU vor jeder Nutzerinteraktion auslösen kann. Jede Zeile stellt die regulatorische Außenansicht dem lokalen CLI-Befund gegenüber.',
    doc: 'KLAR-IMF-01',
    scope: 'Umfang: First Paint vor Einwilligung',
    engine: 'Engine: Playwright Chromium (lokal)',
    regulator: 'Externe Regulator-Prüfung',
    cli: 'KlarAudit-CLI-Ausgabe',
    rows: [
      {
        index: '01',
        code: 'TRACKING_CONSENT',
        severity: 'CRITICAL',
        title: 'Netzwerkabfang vor der Einwilligung',
        body: 'Erfasst GTM, Meta Pixel und weitere bekannte Tracker, die vor dem Consent-Klick feuern. Der Runner hängt Request-Hooks vor der Navigation ein und klickt niemals auf Akzeptieren.',
        refs: 'TTDSG / TDDDG § 25, DSGVO Art. 6',
        regulator:
          'Abmahn-Crawler protokollieren googletagmanager.com und facebook.net bereits beim First Paint. Die Besucher-IP liegt dann in einem US-Verarbeitungsprotokoll. Speichern oder Auslesen auf dem Endgerät ohne § 25 TDDDG-Grundlage.',
        cli: 'TRACKING_CONSENT  CRITICAL  -30\nGoogle Tag Manager (googletagmanager.com)\nFirst Paint vor Einwilligung\nEvidenz: gtag/js-URL · GeoIP US',
      },
      {
        index: '02',
        code: 'CROSS_BORDER_TRANSFER',
        severity: 'HIGH',
        title: 'Dynamische Drittland-IP-Leaks',
        body: 'Erkennt Google Fonts, andere Non-EU-Drittanbieter und First-Party-CDN-/Hosting-Edges (z. B. Vercel außerhalb der EU). Remote-IPs werden mit einer Offline-GeoIP-Datenbank klassifiziert. Der Scanner ruft keine Cloud-Lookup-API auf.',
        refs: 'LG München 3 O 17493/20, Schrems II',
        regulator:
          'Das LG München I hat das Laden von Google Fonts von US-Servern ohne Einwilligung als unzulässige IP-Übermittlung bewertet. Schrems II hat Privacy Shield ungültig gemacht. Unannotierte US-Transfers bleiben ein Bußgeldrisiko nach Art. 83 DSGVO.',
        cli: 'CROSS_BORDER_TRANSFER  HIGH  -15\nGoogle Fonts fonts.googleapis.com\nIP 142.250.185.196 · GeoIP US\nSchriften selbst hosten oder bis Consent verzögern',
      },
      {
        index: '03',
        code: 'BANNER_DARK_PATTERN',
        severity: 'MEDIUM',
        title: 'Einwilligungsschicht und Dark Patterns',
        body: 'Prüft das First-Layer-DOM auf eine Ablehnen-Aktion mit gleicher Prominenz wie Akzeptieren. Bei Fehlern listet der Report die Drittanbieter-Hosts oder Cookies, die ein Banner erforderlich machen.',
        refs: 'EDSA-Leitlinien 03/2022',
        regulator:
          'Die EDSA-Leitlinien 03/2022 verlangen eine echte Wahl. Ein prominentes Akzeptieren neben einem grauen Einstellungen-Link gilt als Dark Pattern. Gleichwertiges Ablehnen ist der deutsche Maßstab.',
        cli: 'BANNER_DARK_PATTERN  MEDIUM  -10\nKein gleichwertiges Ablehnen\nbei Hosts: googletagmanager.com',
      },
      {
        index: '04',
        code: 'CI_GATE',
        severity: 'GATE',
        title: 'Lokale Pipeline-Sperre und Offline-Prüfung',
        body: 'Läuft vollständig in Ihrem Runner oder CLI. Keine Cloud-Abhängigkeiten. Deterministische Exit-Codes für CI/CD. Netzwerkmitschnitt, DOM-Heuristik und GeoIP bleiben auf dem Rechner, der den Scan gestartet hat. Maschinenlesbar: --format json.',
        refs: 'CI-Exit-Vertrag, DSGVO Art. 32',
        regulator:
          'Externe Scanner warten nicht auf ein SaaS-Dashboard. Sie bewerten die ausgelieferte Seite. Ein Merge, der eine US-Schrift oder ein Pre-Consent-Pixel einführt, ist beim nächsten Crawl sichtbar.',
        cli: '--ci  exit 1\nStatus NON_COMPLIANT oder jeder CRITICAL/HIGH-Befund\nnpx klaraudit scan URL --format json',
      },
    ],
  },
  rules: {
    eyebrow: 'Bewertung',
    title: 'Heuristische Abzüge und Statusbänder',
    lead: 'Basiswert 100. Abzüge je Vorfall, danach auf 0 begrenzt. CRITICAL-Abzüge sind auf -60 gedeckelt. Es handelt sich um technische Heuristiken, nicht um ein Rechtsgutachten.',
    colCategory: 'Kategorie',
    colSeverity: 'Schwere',
    colDeduction: 'Abzug',
    colCriteria: 'Kriterien',
    items: [
      {
        category: 'Tracking-Einwilligung',
        severity: 'CRITICAL',
        deduction: '-30 / Vorfall (CRITICAL gesamt gedeckelt bei -60)',
        criteria:
          'Benannte Anbieter (GTM, Google Analytics, Meta Pixel, DoubleClick, Hotjar, TikTok, Clarity) oder Tracking-Cookies feuern beim First Paint. Befunde enthalten Request-URL und konkreten Fix. Fehlendes First-Layer-Banner bei Drittanbieter-Aktivität ist ebenfalls CRITICAL.',
      },
      {
        category: 'Drittlandtransfer',
        severity: 'HIGH',
        deduction: '-15 / eindeutiges Nicht-EU-Asset',
        criteria:
          'Requests außerhalb von EU/EWR via lokalem geoip-lite. Unterscheidet Google Fonts, Drittanbieter und First-Party-CDN-/Hosting-Edges. Evidenz enthält IP und Land, sofern verfügbar.',
      },
      {
        category: 'Banner-Dark-Patterns',
        severity: 'MEDIUM',
        deduction: '-10 / Vorfall',
        criteria:
          'Consent-UI vorhanden, aber Ablehnen fehlt oder ist schwächer als Akzeptieren auf der ersten Schicht. Der Report listet die auslösenden Drittanbieter-Hosts/Cookies.',
      },
      {
        category: 'Pflichtseiten',
        severity: 'LOW',
        deduction: '-5 / fehlende Seite',
        criteria:
          '/impressum bzw. /imprint und /datenschutz bzw. /privacy müssen HTTP 200 liefern. Befunde enthalten geprüfte URL und Status.',
      },
    ],
    bands: [
      {
        status: 'COMPLIANT',
        range: '>= 85',
        note: 'Heuristische Schwelle für den First Paint erreicht.',
      },
      {
        status: 'WARNING',
        range: '60-84',
        note: 'Befunde bleiben. Vor dem Launch prüfen.',
      },
      {
        status: 'NON_COMPLIANT',
        range: '< 60',
        note: '--ci beendet mit 1. Vor dem Launch beheben.',
      },
    ],
  },
  pricing: {
    eyebrow: 'Lizenz',
    title: 'Kostenlos und Open Source unter MIT',
    lead: 'KlarAudit ist ein Portfolio-Projekt von Shoebill Software. Die gesamte CLI ist kostenfrei: lokale Scans, CI-Gates, JSON und A4-PDF-Berichte. Kein Konto, keine Telemetrie, keine bezahlte Stufe.',
    includes: [
      'MIT-Lizenz — nutzen, ändern und weitergeben',
      'Terminal-, JSON- und A4-PDF-Ausgabe',
      'Lokal per npx oder Docker mit gebündeltem Chromium',
      'Deterministische --ci-Exit-Codes für Merge-Gates',
    ],
    ctaGithub: 'Quellcode auf GitHub',
    ctaNpm: 'npm-Paket',
    commandsLabel: 'Lokal ausführen',
    npxCommand: 'npx klaraudit scan https://example.com',
    jsonCommand: 'npx klaraudit scan https://example.com --format json',
    footnote:
      'Befunde sind technische Heuristiken, keine Rechtsberatung. Für npx einmal Chromium installieren: npx playwright-core@1.63.0 install chromium — oder das Docker-Image nutzen, das den Browser bereits enthält.',
  },
  footer: {
    product: 'KlarAudit',
    blurb: 'Headless-Scanner für EU-Datenschutz. Nur lokale Ausführung.',
    disclaimer:
      'KlarAudit ist ein technisches Prüfwerkzeug. Befunde sind Heuristiken, keine Rechtsberatung, und ersetzen keinen qualifizierten Rechtsrat. Bußgelder nach Art. 83 DSGVO und Abmahnungen hängen von Sachverhalten ab, die ein First-Paint-Scan nicht vollständig feststellen kann.',
    license: 'MIT-Lizenz',
    builtBy: 'Erstellt von Shoebill Software.',
  },
};

const es = {
  meta: {
    title: 'KlarAudit: Audita tu sitio web antes de que intervengan los reguladores europeos',
    description:
      'Escáner CLI local para RGPD, ePrivacy y Schrems II. Intercepta GTM, Meta Pixel y Google Fonts antes del consentimiento. GeoIP sin conexión. Códigos de salida CI deterministas. Desarrollado por Shoebill Software.',
    skip: 'Saltar al contenido',
  },
  nav: {
    manifest: 'Manifiesto',
    scoring: 'Puntuación',
    license: 'Licencia',
    github: 'GitHub',
    lang: 'Idioma',
  },
  hero: {
    kicker: 'CLI local. RGPD, ePrivacy, Schrems II.',
    headline: 'Audita tu sitio web antes de que intervengan los reguladores europeos.',
    subhead:
      'KlarAudit lanza Chromium headless en tu máquina, registra las peticiones del first paint antes de cualquier clic de consentimiento y puntúa la página según TTDSG / TDDDG § 25, RGPD art. 6 y art. 83, LG München 3 O 17493/20 y Schrems II. Sin cuenta en la nube. Sin telemetría. Código de salida 1 ante hallazgos CRITICAL o HIGH.',
    commandLabel: 'Inspección local',
    copy: 'Copiar',
    copied: 'Copiado al portapapeles.',
    copiedShort: 'Copiado',
    copyFailed: 'La copia falló. Selecciona el comando manualmente.',
    cicd: 'Puerta CI/CD',
    source: 'Código en GitHub',
  },
  terminal: {
    eyebrow: 'Traza de ejemplo',
    title: 'Lo que imprime la CLI en un first paint no conforme',
    body: 'KlarAudit no pulsa Aceptar. Observa la carga en reposo, resuelve las IP remotas con una base GeoIP local y puntúa la página con evidencias accionables (URL, IP, GeoIP, remediación). La traza corresponde a una ejecución NON_COMPLIANT representativa.',
    windowTitle: 'klaraudit scan https://shop.example.de --ci',
    scanning: 'Scanning https://shop.example.de  timeout=15000ms',
    intercept: 'intercept network (pre-consent, no click)',
    targets: 'targets: cookies, scripts, fonts, banner DOM, /impressum, /datenschutz',
    gtm: 'FAIL  Google Tag Manager  googletagmanager.com  antes del consentimiento',
    fonts: 'FAIL  Google Fonts  fonts.googleapis.com  142.250.185.196 · GeoIP US',
    banner: 'FAIL  falta Rechazar / Ablehnen  con hosts: googletagmanager.com',
    pages: 'OK    /impressum 200  /datenschutz 200',
    score: 'Score  45 / 100',
    status: 'Status NON_COMPLIANT  (umbral < 60)',
    ciFail: 'CI gate: FAIL  el estado es NON_COMPLIANT; hay violaciones CRITICAL o HIGH.',
    exit: 'exit 1',
    colSeverity: 'Gravedad',
    colCategory: 'Categoría',
    colFinding: 'Hallazgo',
    colDelta: 'Delta',
    colFix: 'Remediación',
    findings: [
      {
        severity: 'CRITICAL',
        category: 'TRACKING_CONSENT',
        finding:
          'Google Tag Manager (googletagmanager.com) se cargó en el first paint antes de cualquier clic de consentimiento',
        deduction: '-30',
        fix: 'Cargar GTM solo tras el opt-in (Consent Mode / puerta CMP).',
      },
      {
        severity: 'HIGH',
        category: 'CROSS_BORDER_TRANSFER',
        finding:
          'Google Fonts desde fonts.googleapis.com resolvió a IP 142.250.185.196 en US — IP del visitante enviada a Google antes del consentimiento',
        deduction: '-15',
        fix: 'Autoalojar fuentes o cargar Google Fonts solo tras el consentimiento.',
      },
      {
        severity: 'MEDIUM',
        category: 'BANNER_DARK_PATTERN',
        finding:
          'Hay UI de consentimiento, pero falta Rechazar / Ablehnen con igual prominencia mientras hay hosts de terceros',
        deduction: '-10',
        fix: 'Colocar Ablehnen junto a Aceptar con el mismo peso visual.',
      },
    ],
  },
  manifest: {
    eyebrow: 'Manifiesto de inspección',
    title: 'Controles de first paint, en orden de inspección',
    lead: 'Catálogo secuencial de las comprobaciones que puede disparar un escaneo automatizado alemán o europeo antes de cualquier interacción. Cada fila enfrenta la vista del regulador externo con el hallazgo local de la CLI.',
    doc: 'KLAR-IMF-01',
    scope: 'Alcance: first paint previo al consentimiento',
    engine: 'Motor: Playwright Chromium (local)',
    regulator: 'Escaneo de un regulador externo',
    cli: 'Salida de KlarAudit CLI',
    rows: [
      {
        index: '01',
        code: 'TRACKING_CONSENT',
        severity: 'CRITICAL',
        title: 'Intercepción de red previa al consentimiento',
        body: 'Detecta GTM, Meta Pixel y otros rastreadores conocidos que se disparan antes de que el usuario pulse consentimiento. El runner engancha las peticiones de página antes de la navegación y nunca pulsa Aceptar.',
        refs: 'TTDSG / TDDDG § 25, RGPD art. 6',
        regulator:
          'Los rastreadores de requerimientos registran googletagmanager.com y facebook.net en el first paint. La IP del visitante ya está en un registro de un encargado estadounidense. El almacenamiento o acceso en el equipo terminal carece de base en el § 25 TDDDG.',
        cli: 'TRACKING_CONSENT  CRITICAL  -30\nGoogle Tag Manager (googletagmanager.com)\ncargado en first paint antes del consentimiento\nevidencia: URL gtag/js · GeoIP US',
      },
      {
        index: '02',
        code: 'CROSS_BORDER_TRANSFER',
        severity: 'HIGH',
        title: 'Fugas dinámicas de IP transfronterizas',
        body: 'Detecta Google Fonts, otros hosts de terceros fuera de la UE y edges CDN/hosting de primera parte (por ejemplo un edge de Vercel fuera de la UE). Las IP remotas se clasifican con una base GeoIP local. El escáner no llama a una API de lookup en la nube.',
        refs: 'LG München 3 O 17493/20, Schrems II',
        regulator:
          'El LG München I consideró que cargar Google Fonts desde servidores estadounidenses sin consentimiento transmite ilícitamente la IP del visitante. Schrems II invalidó el Privacy Shield. Las transferencias a EE. UU. sin anotar siguen siendo un riesgo de multa del art. 83 RGPD.',
        cli: 'CROSS_BORDER_TRANSFER  HIGH  -15\nGoogle Fonts fonts.googleapis.com\nIP 142.250.185.196 · GeoIP US\nAutoalojar fuentes o retrasar hasta el consentimiento',
      },
      {
        index: '03',
        code: 'BANNER_DARK_PATTERN',
        severity: 'MEDIUM',
        title: 'Capa de consentimiento y patrones oscuros',
        body: 'Valida el DOM de la primera capa en busca de una acción de rechazo con la misma prominencia que aceptar. Si falla, el informe lista los hosts o cookies de terceros que hicieron necesario el banner.',
        refs: 'Directrices del CEPD 03/2022',
        regulator:
          'Las Directrices del CEPD 03/2022 exigen una elección real. Un Aceptar destacado junto a un enlace gris de ajustes se trata como patrón oscuro. Un Ablehnen de igual prominencia es la referencia alemana.',
        cli: 'BANNER_DARK_PATTERN  MEDIUM  -10\nFalta Rechazar / Ablehnen con igual prominencia\nmientras hosts: googletagmanager.com',
      },
      {
        index: '04',
        code: 'CI_GATE',
        severity: 'GATE',
        title: 'Puerta de pipeline local y auditoría sin conexión',
        body: 'Se ejecuta por completo en tu runner o CLI. Cero dependencias en la nube. Códigos de salida deterministas para CI/CD. La captura de red, las heurísticas DOM y GeoIP permanecen en la máquina que lanzó el escaneo. Use --format json para salida legible por máquina.',
        refs: 'Contrato de salida CI, RGPD art. 32',
        regulator:
          'Los escáneres externos no esperan a un panel SaaS. Puntúan el sitio tal como se entrega. Un merge que introduce una fuente estadounidense o un píxel pre-consentimiento es visible en el siguiente rastreo.',
        cli: '--ci  exit 1\nestado NON_COMPLIANT, o cualquier hallazgo CRITICAL/HIGH\nnpx klaraudit scan URL --format json',
      },
    ],
  },
  rules: {
    eyebrow: 'Puntuación',
    title: 'Deducciones heurísticas y bandas de estado',
    lead: 'Puntuación base 100. Las deducciones se aplican por incidente y el resultado se recorta a 0. Las deducciones CRITICAL tienen un tope de -60. Son heurísticas técnicas, no un dictamen jurídico.',
    colCategory: 'Categoría',
    colSeverity: 'Gravedad',
    colDeduction: 'Deducción',
    colCriteria: 'Criterios',
    items: [
      {
        category: 'Consentimiento de rastreo',
        severity: 'CRITICAL',
        deduction: '-30 / incidente (CRITICAL total limitado a -60)',
        criteria:
          'Proveedores concretos (GTM, Google Analytics, Meta Pixel, DoubleClick, Hotjar, TikTok, Clarity) o cookies de rastreo se disparan en el first paint. Los hallazgos incluyen la URL de la petición y una remediación concreta. Un banner de primera capa ausente con actividad de terceros también es CRITICAL.',
      },
      {
        category: 'Transferencia transfronteriza',
        severity: 'HIGH',
        deduction: '-15 / activo no UE único',
        criteria:
          'Peticiones resueltas fuera del EEE mediante geoip-lite local. Distingue Google Fonts, hosts de terceros y edges CDN/hosting de primera parte. La evidencia incluye IP y país cuando está disponible.',
      },
      {
        category: 'Patrones oscuros del banner',
        severity: 'MEDIUM',
        deduction: '-10 / incidente',
        criteria:
          'Existe una IU de consentimiento, pero Rechazar / Ablehnen (o equivalente) falta o es más débil que Aceptar en la primera capa. El informe lista los hosts/cookies de terceros que activaron la comprobación.',
      },
      {
        category: 'Páginas obligatorias',
        severity: 'LOW',
        deduction: '-5 / página ausente',
        criteria:
          '/impressum o /imprint y /datenschutz o /privacy deben devolver HTTP 200. Los hallazgos incluyen la URL sondeada y el estado.',
      },
    ],
    bands: [
      {
        status: 'COMPLIANT',
        range: '>= 85',
        note: 'El umbral heurístico del first paint se cumple.',
      },
      {
        status: 'WARNING',
        range: '60-84',
        note: 'Siguen existiendo problemas. Revisar antes del lanzamiento.',
      },
      {
        status: 'NON_COMPLIANT',
        range: '< 60',
        note: '--ci termina con 1. Corregir antes del lanzamiento.',
      },
    ],
  },
  pricing: {
    eyebrow: 'Licencia',
    title: 'Gratis y de código abierto bajo MIT',
    lead: 'KlarAudit es un proyecto de portfolio de Shoebill Software. La CLI completa es gratuita: escaneos locales, puertas CI, JSON e informes PDF A4. Sin cuenta, sin telemetría, sin plan de pago.',
    includes: [
      'Licencia MIT — usar, modificar y redistribuir',
      'Salida en terminal, JSON y PDF A4',
      'npx local o Docker con Chromium incluido',
      'Códigos de salida --ci deterministas para merge gates',
    ],
    ctaGithub: 'Ver código en GitHub',
    ctaNpm: 'Paquete npm',
    commandsLabel: 'Ejecutar en local',
    npxCommand: 'npx klaraudit scan https://example.com',
    jsonCommand: 'npx klaraudit scan https://example.com --format json',
    footnote:
      'Los hallazgos son heurísticas técnicas, no asesoramiento jurídico. Con npx, instala Chromium una vez: npx playwright-core@1.63.0 install chromium — o usa la imagen Docker, que ya incluye el navegador.',
  },
  footer: {
    product: 'KlarAudit',
    blurb: 'Escáner headless de privacidad en la UE. Solo ejecución local.',
    disclaimer:
      'KlarAudit es una herramienta de inspección técnica. Los hallazgos son heurísticas, no asesoramiento jurídico, y no sustituyen a un letrado cualificado. Las multas del artículo 83 del RGPD y los requerimientos alemanes (Abmahnungen) dependen de hechos que un escaneo de first paint no puede establecer por completo.',
    license: 'Licencia MIT',
    builtBy: 'Desarrollado por Shoebill Software.',
  },
};

export const ui = { en, de, es } satisfies Record<Lang, typeof en>;

export type UiCopy = (typeof ui)[Lang];

export function isLang(value: string): value is Lang {
  return value in languages;
}

export function getLangFromUrl(url: URL): Lang {
  const segment = url.pathname.split('/').filter(Boolean)[0];
  if (segment && isLang(segment)) {
    return segment;
  }
  return defaultLang;
}

export function copyFor(lang: Lang): UiCopy {
  return ui[lang];
}
