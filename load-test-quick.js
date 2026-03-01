import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

// ============================================================
// Careers Fair Load Test (QUICK) - https://find.careers.gov.sg
// ============================================================
// Quick 5-minute version for testing/validation purposes.
// Same test flow and weighted distribution as the full test.
// ============================================================

// --- User Journey Drop-off Rates ---
const DROP_OFF = {
  PROCEED_TO_QUESTIONNAIRE: 0.80,
  COMPLETE_QUESTIONNAIRE:   0.70,
  DOWNLOAD_PDF:             0.30,
};

// --- Custom Metrics (all durations in milliseconds) ---
const landingPageDuration = new Trend("landing_page_duration_ms", true);
const questionnaireDuration = new Trend("questionnaire_page_duration_ms", true);
const matchingRolesDuration = new Trend("matching_roles_api_duration_ms", true);
const generatePdfDuration = new Trend("generate_pdf_api_duration_ms", true);
const errorRate = new Rate("errors");
const pdfErrors = new Counter("pdf_generation_errors");

// --- Test Data ---
const JOB_FUNCTIONS = [
  "data-tech-digital",
  "comms-engagement",
  "policy-governance",
  "hr",
  "finance-economy",
  "education",
  "environment",
];

const EXPERIENCE_RANGES = [
  "1-3 years",
  "4-6 years",
  "7-9 years",
  ">10 years",
];

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];

const BASE_URL = "https://find.careers.gov.sg";

// --- Quick Load Profile (5 minutes total) ---
export const options = {
  scenarios: {
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 5 },   // Warm up
        { duration: "30s", target: 19 },  // Ramp to expected load
        { duration: "2m", target: 19 },   // Sustain expected load
        { duration: "30s", target: 38 },  // 2x peak (stress test)
        { duration: "1m", target: 38 },   // Sustain 2x peak
        { duration: "30s", target: 0 },   // Ramp down
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // Page loads: p90 < 2s, p95 < 3s, p99 < 5s
    landing_page_duration_ms: ["p(90)<2000", "p(95)<3000", "p(99)<5000"],
    questionnaire_page_duration_ms: ["p(90)<2000", "p(95)<3000", "p(99)<5000"],
    // API calls: p90 < 3s, p95 < 5s, p99 < 8s
    matching_roles_api_duration_ms: ["p(90)<3000", "p(95)<5000", "p(99)<8000"],
    // PDF generation: p90 < 5s, p95 < 10s, p99 < 15s
    generate_pdf_api_duration_ms: ["p(90)<5000", "p(95)<10000", "p(99)<15000"],
    // Error rate should be under 1%
    errors: ["rate<0.01"],
    // Overall HTTP failure rate
    http_req_failed: ["rate<0.01"],
    // Per-request HTTP failure breakdown
    "http_req_failed{name:landing_page}": ["rate<0.01"],
    "http_req_failed{name:questionnaire_page}": ["rate<0.01"],
    "http_req_failed{name:js_bundle}": ["rate<0.01"],
    "http_req_failed{name:css_bundle}": ["rate<0.01"],
    "http_req_failed{name:get_counts}": ["rate<0.01"],
    "http_req_failed{name:get_matching_roles}": ["rate<0.01"],
    "http_req_failed{name:results_page}": ["rate<0.01"],
    "http_req_failed{name:get_roles_for_pdf}": ["rate<0.01"],
    "http_req_failed{name:generate_pdf}": ["rate<0.01"],
  },
};

// --- Helper: Build tRPC query URL ---
function trpcQueryUrl(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return `${BASE_URL}/api/trpc/${procedure}?input=${encoded}`;
}

// --- Helper: Random questionnaire answers ---
function randomAnswers() {
  const numFunctions = Math.floor(Math.random() * 3) + 1;
  const shuffled = JOB_FUNCTIONS.sort(() => 0.5 - Math.random());
  const jobFunctions = shuffled.slice(0, numFunctions);

  return {
    jobFunctions,
    experienceRange: randomItem(EXPERIENCE_RANGES),
    employmentType: randomItem(EMPLOYMENT_TYPES),
  };
}

// --- Default Headers ---
const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

// --- Main Test Flow ---
export default function () {
  const answers = randomAnswers();

  // ── Step 1: Landing page (100% of users) ──────────────────
  group("01 - Landing Page", () => {
    const res = http.get(BASE_URL, { headers, tags: { name: "landing_page" } });
    landingPageDuration.add(res.timings.duration);
    const success = check(res, {
      "landing page status 200": (r) => r.status === 200,
      "landing page has content": (r) => r.body.includes("Careers@Gov"),
    });
    errorRate.add(!success);
  });

  sleep(1);

  // ── Step 2: Questionnaire page (80% of users) ────────────
  if (Math.random() > DROP_OFF.PROCEED_TO_QUESTIONNAIRE) return;

  group("02 - Questionnaire Page", () => {
    const res = http.get(`${BASE_URL}/questionnaire`, {
      headers,
      tags: { name: "questionnaire_page" },
    });
    questionnaireDuration.add(res.timings.duration);
    const success = check(res, {
      "questionnaire page status 200": (r) => r.status === 200,
    });
    errorRate.add(!success);
  });

  sleep(1);

  // ── Step 3: Static assets (loaded alongside questionnaire) ─
  group("03 - Static Assets", () => {
    const responses = http.batch([
      ["GET", `${BASE_URL}/assets/index-tIaK2_Hj.js`, null, { headers, tags: { name: "js_bundle" } }],
      ["GET", `${BASE_URL}/assets/index-BJ2BuKoM.css`, null, { headers, tags: { name: "css_bundle" } }],
    ]);
    for (const res of responses) {
      const success = check(res, {
        "asset loaded": (r) => r.status === 200,
      });
      errorRate.add(!success);
    }
  });

  // ── Step 4: Statistics API (background fetch) ─────────────
  group("04 - Get Statistics", () => {
    const url = trpcQueryUrl("statistics.getCounts", {});
    const res = http.get(url, { headers, tags: { name: "get_counts" } });
    const success = check(res, {
      "getCounts status 200": (r) => r.status === 200,
      "getCounts has data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result?.data?.json?.boothCount > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!success);
  });

  sleep(1);

  // ── Step 5: Get matching roles (70% of users) ─────────────
  if (Math.random() > DROP_OFF.COMPLETE_QUESTIONNAIRE) return;

  group("05 - Get Matching Roles", () => {
    const url = trpcQueryUrl("questionnaire.getMatchingRoles", answers);
    const res = http.get(url, {
      headers,
      tags: { name: "get_matching_roles" },
    });
    matchingRolesDuration.add(res.timings.duration);

    const success = check(res, {
      "getMatchingRoles status 200": (r) => r.status === 200,
      "getMatchingRoles has roles": (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.result?.data?.json?.roles);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!success);
  });

  sleep(1);

  // ── Step 6: Generate & download PDF (30% of users) ────────
  if (Math.random() > DROP_OFF.DOWNLOAD_PDF) return;

  group("06 - Generate PDF", () => {
    const res = http.get(`${BASE_URL}/results`, {
      headers,
      tags: { name: "results_page" },
    });
    const pageSuccess = check(res, {
      "results page status 200": (r) => r.status === 200,
    });
    errorRate.add(!pageSuccess);

    sleep(1);

    const rolesUrl = trpcQueryUrl("questionnaire.getMatchingRoles", answers);
    const rolesRes = http.get(rolesUrl, {
      headers,
      tags: { name: "get_roles_for_pdf" },
    });

    let pdfPayload;
    try {
      const rolesData = JSON.parse(rolesRes.body);
      const roles = rolesData.result?.data?.json?.roles || [];
      const booths = rolesData.result?.data?.json?.booths || [];

      pdfPayload = {
        json: {
          roles: roles.slice(0, 10),
          booths: booths.slice(0, 10),
          exactMatchCount: roles.length,
          isFallback: false,
        },
      };
    } catch {
      pdfPayload = {
        json: {
          roles: [],
          booths: [],
          exactMatchCount: 0,
          isFallback: true,
        },
      };
    }

    const pdfRes = http.post(
      `${BASE_URL}/api/trpc/questionnaire.generatePDF`,
      JSON.stringify(pdfPayload),
      { headers, tags: { name: "generate_pdf" }, timeout: "30s" }
    );
    generatePdfDuration.add(pdfRes.timings.duration);

    const pdfSuccess = check(pdfRes, {
      "generatePDF status 200": (r) => r.status === 200,
      "generatePDF has response": (r) => r.body && r.body.length > 0,
    });
    errorRate.add(!pdfSuccess);
    if (!pdfSuccess) {
      pdfErrors.add(1);
    }
  });

  sleep(1);
}

// --- Report Generation ---
function formatSGT() {
  const now = new Date();
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = sgt.getUTCFullYear();
  const m = String(sgt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(sgt.getUTCDate()).padStart(2, "0");
  const h = String(sgt.getUTCHours()).padStart(2, "0");
  const min = String(sgt.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min} SGT`;
}

export function handleSummary(data) {
  return {
    "report.html": htmlReport(data, {
      title: `K6 Load Test Report - ${formatSGT()}`,
    }),
    "report.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
