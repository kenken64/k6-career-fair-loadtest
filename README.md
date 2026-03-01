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

> Based on the full 52-minute load test (19,322 iterations, 101,726 HTTP requests)

### Performance Summary

| Metric | Avg | Med | P90 | P95 | Max | Status |
|--------|-----|-----|-----|-----|-----|--------|
| Landing page | 275.94ms | 260.48ms | 356.17ms | 373.50ms | 2,696.42ms | PASS |
| Questionnaire page | 443.63ms | 429.13ms | 522.47ms | 544.53ms | 1,430.05ms | PASS |
| Matching roles API | 119.74ms | 101.91ms | 201.80ms | 216.45ms | 670.76ms | PASS |
| PDF generation | 94.88ms | 85.10ms | 113.54ms | 126.74ms | 318.86ms | PASS |

### Reliability

| Metric | Value | Status |
|--------|-------|--------|
| Total HTTP requests | 101,726 | |
| HTTP failure rate | 0.007% (7 failures) | PASS |
| Check pass rate | 99.99% (147,369 / 147,379) | PASS |
| Error rate | 0.007% | PASS |

### Per-Request Failure Breakdown

| Request | Failures | Total | Failure Rate | Status |
|---------|----------|-------|-------------|--------|
| Landing page | 1 | 19,322 | 0.005% | PASS |
| Questionnaire page | 1 | 15,490 | 0.006% | PASS |
| JS bundle | 2 | 15,490 | 0.013% | PASS |
| CSS bundle | 0 | 15,490 | 0.000% | PASS |
| Statistics API | 2 | 15,490 | 0.013% | PASS |
| Matching roles API | 0 | 10,841 | 0.000% | PASS |
| Results page | 1 | 3,201 | 0.031% | PASS |
| Roles for PDF | 0 | 3,201 | 0.000% | PASS |
| Generate PDF | 0 | 3,201 | 0.000% | PASS |

### Check Results

| Group | Check | Passes | Fails |
|-------|-------|--------|-------|
| 01 - Landing Page | landing page status 200 | 19,321 | 1 |
| 01 - Landing Page | landing page has content | 19,321 | 1 |
| 02 - Questionnaire Page | questionnaire page status 200 | 15,489 | 1 |
| 03 - Static Assets | asset loaded | 30,978 | 2 |
| 04 - Get Statistics | getCounts status 200 | 15,488 | 2 |
| 04 - Get Statistics | getCounts has data | 15,488 | 2 |
| 05 - Get Matching Roles | getMatchingRoles status 200 | 10,841 | 0 |
| 05 - Get Matching Roles | getMatchingRoles has roles | 10,841 | 0 |
| 06 - Generate PDF | results page status 200 | 3,200 | 1 |
| 06 - Generate PDF | generatePDF status 200 | 3,201 | 0 |
| 06 - Generate PDF | generatePDF has response | 3,201 | 0 |

### Network

| Metric | Value |
|--------|-------|
| Data sent | 90.42 MB |
| Data received | 21.34 GB |
| Avg request duration | 274.11ms |
| Test duration | 52 min 3s |

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
