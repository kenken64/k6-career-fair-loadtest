import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";

// ============================================================
// Careers Fair Load Test - https://find.careers.gov.sg
// ============================================================
// Context:
//   - 13,000 visitors over 8 hours at Suntec City Hall
//   - ~1,625 pax/hour
//   - 70% app usage = ~1,138 users/hour = ~19 users/min
//
// Test scenarios:
//   1. Landing page load
//   2. Questionnaire page load
//   3. Get matching roles (API query)
//   4. Generate & download PDF (API mutation)
// ============================================================

// --- Custom Metrics ---
const landingPageDuration = new Trend("landing_page_duration", true);
const questionnaireDuration = new Trend("questionnaire_page_duration", true);
const matchingRolesDuration = new Trend("matching_roles_api_duration", true);
const generatePdfDuration = new Trend("generate_pdf_api_duration", true);
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

// --- Load Profile ---
// Ramp up to peak concurrency simulating fair-day traffic.
// Peak: ~19 VUs (virtual users) each completing a journey every ~60s
// = ~1,140 journeys/hour ≈ 70% of 1,625 pax/hour
export const options = {
  scenarios: {
    // Scenario 1: Ramp-up test (quick validation)
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 5 },    // Warm up
        { duration: "2m", target: 19 },   // Ramp to expected load
        { duration: "5m", target: 19 },   // Sustain expected load
        { duration: "2m", target: 38 },   // 2x peak (stress test)
        { duration: "3m", target: 38 },   // Sustain 2x peak
        { duration: "2m", target: 0 },    // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Page loads should be under 3s for p95
    landing_page_duration: ["p(95)<3000"],
    questionnaire_page_duration: ["p(95)<3000"],
    // API calls should be under 5s for p95
    matching_roles_api_duration: ["p(95)<5000"],
    // PDF generation can be slower, under 10s for p95
    generate_pdf_api_duration: ["p(95)<10000"],
    // Error rate should be under 1%
    errors: ["rate<0.01"],
    // Overall HTTP failure rate
    http_req_failed: ["rate<0.01"],
  },
};

// --- Helper: Build tRPC query URL ---
function trpcQueryUrl(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return `${BASE_URL}/api/trpc/${procedure}?input=${encoded}`;
}

// --- Helper: Random questionnaire answers ---
function randomAnswers() {
  // Pick 1-3 random job functions
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

  // Step 1: Load landing page
  group("01 - Landing Page", () => {
    const res = http.get(BASE_URL, { headers, tags: { name: "landing_page" } });
    landingPageDuration.add(res.timings.duration);
    check(res, {
      "landing page status 200": (r) => r.status === 200,
      "landing page has content": (r) => r.body.includes("Careers@Gov"),
    }) || errorRate.add(1);
    sleep(randomThinkTime(1, 3));
  });

  // Step 2: Load questionnaire page
  group("02 - Questionnaire Page", () => {
    const res = http.get(`${BASE_URL}/questionnaire`, {
      headers,
      tags: { name: "questionnaire_page" },
    });
    questionnaireDuration.add(res.timings.duration);
    check(res, {
      "questionnaire page status 200": (r) => r.status === 200,
    }) || errorRate.add(1);
    sleep(randomThinkTime(2, 5));
  });

  // Step 3: Load static assets (JS bundle + CSS)
  group("03 - Static Assets", () => {
    const responses = http.batch([
      ["GET", `${BASE_URL}/assets/index-tIaK2_Hj.js`, null, { headers, tags: { name: "js_bundle" } }],
      ["GET", `${BASE_URL}/assets/index-BJ2BuKoM.css`, null, { headers, tags: { name: "css_bundle" } }],
    ]);
    for (const res of responses) {
      check(res, {
        "asset loaded": (r) => r.status === 200,
      }) || errorRate.add(1);
    }
    sleep(randomThinkTime(1, 2));
  });

  // Step 4: Fetch statistics (getCounts)
  group("04 - Get Statistics", () => {
    const url = trpcQueryUrl("statistics.getCounts", {});
    const res = http.get(url, { headers, tags: { name: "get_counts" } });
    check(res, {
      "getCounts status 200": (r) => r.status === 200,
      "getCounts has data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result?.data?.json?.boothCount > 0;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
    sleep(randomThinkTime(1, 2));
  });

  // Step 5: User fills questionnaire, then fetches matching roles
  group("05 - Get Matching Roles", () => {
    // Simulate user think time while filling questionnaire
    sleep(randomThinkTime(5, 15));

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
    if (!success) errorRate.add(1);

    sleep(randomThinkTime(3, 8));
  });

  // Step 6: View results page then generate PDF
  group("06 - Generate PDF", () => {
    const res = http.get(`${BASE_URL}/results`, {
      headers,
      tags: { name: "results_page" },
    });
    check(res, {
      "results page status 200": (r) => r.status === 200,
    }) || errorRate.add(1);

    sleep(randomThinkTime(2, 5));

    // Generate PDF - this is a mutation (POST)
    // The PDF endpoint expects roles, booths, exactMatchCount, isFallback
    // We simulate this by first getting the roles, then requesting PDF
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
          roles: roles.slice(0, 10), // Limit to first 10 roles for PDF
          booths: booths.slice(0, 10),
          exactMatchCount: roles.length,
          isFallback: false,
        },
      };
    } catch {
      // Fallback payload if roles fetch failed
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
    if (!pdfSuccess) {
      errorRate.add(1);
      pdfErrors.add(1);
    }

    sleep(randomThinkTime(1, 3));
  });
}

// --- Think Time (simulates real user pauses) ---
function randomThinkTime(min, max) {
  return min + Math.random() * (max - min);
}

// --- Report Generation ---
export function handleSummary(data) {
  return {
    "report.html": htmlReport(data),
    "report.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
