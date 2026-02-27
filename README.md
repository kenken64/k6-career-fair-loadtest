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

### Full Load Test (`load-test.js`)

15-minute ramping load test simulating real user traffic patterns.

| Stage | Duration | Virtual Users | Purpose |
|-------|----------|---------------|---------|
| Warm up | 1 min | 0 → 5 | Gradual start |
| Ramp to expected | 2 min | 5 → 19 | Match projected traffic |
| Sustain expected | 5 min | 19 | Steady-state |
| Ramp to 2x peak | 2 min | 19 → 38 | Stress test |
| Sustain 2x peak | 3 min | 38 | Sustained stress |
| Ramp down | 2 min | 38 → 0 | Cooldown |

### Load Calculation

| Parameter | Value |
|-----------|-------|
| Total attendees | 13,000 over 8 hours |
| Per hour | ~1,625 |
| App adoption (70%) | ~1,138 users/hour |
| Concurrent users (expected) | 19 VUs |
| Concurrent users (2x stress) | 38 VUs |

## User Journey Simulated

Each virtual user performs this flow with realistic think times:

1. Load landing page (`/`)
2. Load questionnaire page (`/questionnaire`)
3. Load static assets (JS bundle + CSS)
4. Fetch booth/role statistics
5. Fill questionnaire (random answers) → fetch matching roles
6. View results (`/results`) → generate and download PDF

## Thresholds (Pass/Fail Criteria)

| Metric | Threshold |
|--------|-----------|
| Landing page p95 | < 3,000ms |
| Questionnaire page p95 | < 3,000ms |
| Matching roles API p95 | < 5,000ms |
| PDF generation p95 | < 10,000ms |
| Error rate | < 1% |
| HTTP failure rate | < 1% |

## Reports

After running the full load test, reports are generated in the project root:

| File | Description |
|------|-------------|
| `report.html` | Interactive HTML report with charts |
| `report.json` | Raw JSON metrics for custom analysis |
| `load-test-report.md` | Markdown summary report |

**View online:** https://kenken64.github.io/k6-career-fair-loadtest/

Open locally:

```bash
open report.html
```

## Project Structure

```
career-fair-loadtest/
├── run-loadtest.sh        # Runner script (installs deps + runs tests)
├── smoke-test.js          # k6 smoke test
├── load-test.js           # k6 full load test
├── report.html            # Generated HTML report
├── report.json            # Generated JSON report
├── load-test-report.md    # Markdown report
└── README.md              # This file
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

# Full load test
k6 run load-test.js

# Full load test with custom VUs
k6 run --vus 50 --duration 10m load-test.js
```
