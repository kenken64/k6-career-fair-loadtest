import http from "k6/http";
import { check, sleep } from "k6";

// ============================================================
// Smoke Test - Verify all endpoints work before load testing
// Runs 1 virtual user through the full journey once
// ============================================================

const BASE_URL = "https://find.careers.gov.sg";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

function trpcQueryUrl(procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  return `${BASE_URL}/api/trpc/${procedure}?input=${encoded}`;
}

const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export default function () {
  // 1. Landing page
  console.log(">>> Testing landing page...");
  let res = http.get(BASE_URL, { headers });
  check(res, { "landing page 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);

  // 2. Questionnaire page
  console.log(">>> Testing questionnaire page...");
  res = http.get(`${BASE_URL}/questionnaire`, { headers });
  check(res, { "questionnaire 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);

  // 3. Static assets
  console.log(">>> Testing static assets...");
  res = http.get(`${BASE_URL}/assets/index-tIaK2_Hj.js`, { headers });
  check(res, { "JS bundle 200": (r) => r.status === 200 });
  console.log(`    JS Bundle - Status: ${res.status}, Duration: ${res.timings.duration}ms, Size: ${res.body.length} bytes`);

  res = http.get(`${BASE_URL}/assets/index-BJ2BuKoM.css`, { headers });
  check(res, { "CSS bundle 200": (r) => r.status === 200 });
  console.log(`    CSS Bundle - Status: ${res.status}, Duration: ${res.timings.duration}ms`);

  // 4. Statistics API
  console.log(">>> Testing statistics.getCounts...");
  const countsUrl = trpcQueryUrl("statistics.getCounts", {});
  res = http.get(countsUrl, { headers });
  check(res, { "getCounts 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);
  console.log(`    Response: ${res.body.substring(0, 200)}`);

  // 5. Get Matching Roles
  console.log(">>> Testing questionnaire.getMatchingRoles...");
  const answers = {
    jobFunctions: ["data-tech-digital"],
    experienceRange: "4-6 years",
    employmentType: "full-time",
  };
  const rolesUrl = trpcQueryUrl("questionnaire.getMatchingRoles", answers);
  res = http.get(rolesUrl, { headers });
  check(res, { "getMatchingRoles 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);

  let roles = [];
  let booths = [];
  try {
    const data = JSON.parse(res.body);
    roles = data.result?.data?.json?.roles || [];
    booths = data.result?.data?.json?.booths || [];
    console.log(`    Roles returned: ${roles.length}, Booths: ${booths.length}`);
  } catch (e) {
    console.log(`    Failed to parse: ${res.body.substring(0, 200)}`);
  }

  // 6. Results page
  console.log(">>> Testing results page...");
  res = http.get(`${BASE_URL}/results`, { headers });
  check(res, { "results page 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);

  // 7. Generate PDF
  console.log(">>> Testing questionnaire.generatePDF...");
  const pdfPayload = {
    json: {
      roles: roles.slice(0, 5),
      booths: booths.slice(0, 5),
      exactMatchCount: roles.length,
      isFallback: false,
    },
  };
  res = http.post(
    `${BASE_URL}/api/trpc/questionnaire.generatePDF`,
    JSON.stringify(pdfPayload),
    { headers, timeout: "30s" }
  );
  check(res, { "generatePDF 200": (r) => r.status === 200 });
  console.log(`    Status: ${res.status}, Duration: ${res.timings.duration}ms`);
  console.log(`    Response size: ${res.body ? res.body.length : 0} bytes`);
  if (res.status !== 200) {
    console.log(`    Error: ${res.body?.substring(0, 300)}`);
  }

  console.log("\n=== Smoke test complete ===");
}
