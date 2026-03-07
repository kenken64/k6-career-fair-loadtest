# Careers@Gov Booth Finder - Load Test

Load testing suite for the [Careers@Gov Booth Finder](https://find.careers.gov.sg/) web application, built for the **Public Service Careers Fair on 18 April 2026** at Suntec City Hall 401 & 402.

**[View Latest Load Test Report](https://kenken64.github.io/k6-career-fair-loadtest/)**

## Requirements

- **macOS / Linux**
- **Node.js** (LTS)
- **[k6](https://k6.io/)** (Grafana k6)

All dependencies are auto-installed by the runner script.

## Quick Start

```bash
# Run everything (smoke test → full load test)
./run-loadtest.sh

# Run smoke test only (verify endpoints)
./run-loadtest.sh smoke

# Run full load test only (skip smoke test)
./run-loadtest.sh full
```

## Test Scenarios

### Smoke Test (`smoke-test.js`)

Single user, single iteration. Validates all endpoints are reachable before running the full load test.

- Landing page
- Questionnaire page
- Static assets (JS + CSS)
- Statistics API (`statistics.getCounts`)
- Matching roles API (`questionnaire.getMatchingRoles`)
- Results page
- PDF generation (`questionnaire.generatePDF`)

### Quick Load Test (`load-test-quick.js`)

5-minute load test for fast validation. Same test flow and thresholds as the full test.

| Stage | Duration | Virtual Users | Purpose |
|-------|----------|---------------|---------|
| Warm up | 30s | 0 → 5 | Gentle start |
| Ramp to expected | 30s | 5 → 19 | Match projected traffic |
| Sustain expected | 2 min | 19 | Steady-state |
| Ramp to 2x peak | 30s | 19 → 38 | Stress test |
| Sustain 2x peak | 1 min | 38 | Sustained stress |
| Ramp down | 30s | 38 → 0 | Cooldown |

### Full Load Test (`load-test.js`)

52-minute ramping load test simulating real user traffic patterns.

| Stage | Duration | Virtual Users | Purpose |
|-------|----------|---------------|---------|
| Warm up | 2 min | 0 → 5 | Gentle start |
| Ramp to expected | 3 min | 5 → 19 | Match projected traffic |
| Sustain expected | 10 min | 19 | Steady-state |
| Ramp to 2x peak | 3 min | 19 → 38 | Stress test |
| Sustain 2x peak | 30 min | 38 | Sustained stress |
| Ramp down | 4 min | 38 → 0 | Cooldown |

### Load Calculation

| Parameter | Value |
|-----------|-------|
| Total attendees | 13,000 over 8 hours |
| Per hour | ~1,625 |
| App adoption (70%) | ~1,138 users/hour |
| Concurrent users (expected) | 19 VUs |
| Concurrent users (2x stress) | 38 VUs |

## User Journey (Weighted Distribution)

Each virtual user follows a realistic drop-off funnel with 1s think time between steps:

| Step | % of Users | Action |
|------|-----------|--------|
| 1 | 100% | Load landing page (`/`) |
| 2 | 80% | Load questionnaire page (`/questionnaire`) |
| 3 | 80% | Load static assets (JS bundle + CSS) |
| 4 | 80% | Fetch booth/role statistics |
| 5 | 70% | Fill questionnaire (random answers) → fetch matching roles |
| 6 | 30% | View results (`/results`) → generate and download PDF |

## Thresholds (Pass/Fail Criteria)

| Metric | P90 | P95 | P99 |
|--------|-----|-----|-----|
| Landing page duration | < 2,000ms | < 3,000ms | < 5,000ms |
| Questionnaire page duration | < 2,000ms | < 3,000ms | < 5,000ms |
| Matching roles API duration | < 3,000ms | < 5,000ms | < 8,000ms |
| PDF generation duration | < 5,000ms | < 10,000ms | < 15,000ms |
| Error rate | < 1% | | |
| HTTP failure rate | < 1% | | |
| Per-request HTTP failure rate | < 1% (each) | | |

## Latest Test Results

> Based on the full 52-minute load test run on 1 Mar 2026 (19,804 iterations, 104,251 HTTP requests)

### Performance Summary

| Metric | Avg | Med | P90 | P95 | Max | Status |
|--------|-----|-----|-----|-----|-----|--------|
| Landing page | 253.74ms | 241.19ms | 321.28ms | 351.07ms | 1,324.83ms | PASS |
| Questionnaire page | 429.81ms | 414.28ms | 507.47ms | 531.63ms | 1,807.04ms | PASS |
| Matching roles API | 81.58ms | 67.83ms | 156.84ms | 176.64ms | 1,588.58ms | PASS |
| PDF generation | 52.40ms | 49.23ms | 59.78ms | 67.38ms | 265.80ms | PASS |

### Reliability

| Metric | Value | Status |
|--------|-------|--------|
| Total HTTP requests | 104,251 | |
| HTTP failure rate | 0.002% (2 failures) | PASS |
| Check pass rate | 99.998% (151,043 / 151,046) | PASS |
| Error rate | 0.002% | PASS |

### Per-Request Failure Breakdown

| Request | Failures | Total | Failure Rate | Status |
|---------|----------|-------|-------------|--------|
| Landing page | 1 | 19,804 | 0.005% | PASS |
| Questionnaire page | 0 | 15,877 | 0.000% | PASS |
| JS bundle | 1 | 15,877 | 0.006% | PASS |
| CSS bundle | 0 | 15,877 | 0.000% | PASS |
| Statistics API | 0 | 15,877 | 0.000% | PASS |
| Matching roles API | 0 | 11,114 | 0.000% | PASS |
| Results page | 0 | 3,275 | 0.000% | PASS |
| Roles for PDF | 0 | 3,275 | 0.000% | PASS |
| Generate PDF | 0 | 3,275 | 0.000% | PASS |

### Check Results

| Group | Check | Passes | Fails |
|-------|-------|--------|-------|
| 01 - Landing Page | landing page status 200 | 19,803 | 1 |
| 01 - Landing Page | landing page has content | 19,803 | 1 |
| 02 - Questionnaire Page | questionnaire page status 200 | 15,877 | 0 |
| 03 - Static Assets | asset loaded | 31,753 | 1 |
| 04 - Get Statistics | getCounts status 200 | 15,877 | 0 |
| 04 - Get Statistics | getCounts has data | 15,877 | 0 |
| 05 - Get Matching Roles | getMatchingRoles status 200 | 11,114 | 0 |
| 05 - Get Matching Roles | getMatchingRoles has roles | 11,114 | 0 |
| 06 - Generate PDF | results page status 200 | 3,275 | 0 |
| 06 - Generate PDF | generatePDF status 200 | 3,275 | 0 |
| 06 - Generate PDF | generatePDF has response | 3,275 | 0 |

### Network

| Metric | Value |
|--------|-------|
| Data sent | 76.44 MB |
| Data received | 21.87 GB |
| Avg request duration | 249.25ms |
| Test duration | 52 min 2s |

## GitHub Actions Workflow

The load test can be triggered manually via GitHub Actions with different modes:

| Mode | Description | Duration |
|------|-------------|----------|
| `smoke` | Smoke test only | ~30s |
| `quick` | Quick load test | ~5 min |
| `full` | Smoke test + Full load test | ~52 min |
| `all` | Smoke test + Full load test | ~52 min |

Reports are automatically deployed to GitHub Pages after each load test run.

## Reports

After running the full load test, reports are generated:

| File | Description |
|------|-------------|
| `report.html` | Interactive HTML report with charts |
| `report.json` | Raw JSON metrics for custom analysis |

**View online:** https://kenken64.github.io/k6-career-fair-loadtest/

## Project Structure

```
career-fair-loadtest/
├── .github/workflows/
│   └── load-test.yml        # CI workflow (smoke, quick, full, deploy)
├── run-loadtest.sh           # Runner script (installs deps + runs tests)
├── smoke-test.js             # k6 smoke test
├── load-test-quick.js        # k6 quick load test (5 min)
├── load-test.js              # k6 full load test (52 min)
├── analyze/                  # Test report artifacts
│   ├── report.html           # HTML report
│   └── report.json           # JSON report
└── README.md                 # This file
```

## API Endpoints Tested

The app uses **tRPC** for its API layer:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `statistics.getCounts` | GET | Booth and job role counts |
| `questionnaire.getMatchingRoles` | GET | Match roles by job functions, experience, employment type |
| `questionnaire.generatePDF` | POST | Generate PDF with matched roles and booths |

## Running Individual Tests with k6

```bash
# Smoke test
k6 run smoke-test.js

# Quick load test (5 min)
k6 run load-test-quick.js

# Full load test (52 min)
k6 run load-test.js

# Full load test with custom VUs
k6 run --vus 50 --duration 10m load-test.js
```
