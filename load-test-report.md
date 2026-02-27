# Load Test Report: Careers@Gov Booth Finder

**URL:** https://find.careers.gov.sg/questionnaire
**Date:** 27 February 2026
**Tool:** Grafana k6 v1.6.1
**Duration:** 15 minutes

---

## Context

- **Event:** Public Service Careers Fair - 18 April 2026, Suntec City Hall 401 & 402
- **Projected attendees:** 13,000 visitors over 8 hours
- **Estimated app usage:** ~1,625 pax/hour, 70% adoption = ~1,138 users/hour
- **Test scope:** Questionnaire flow + PDF download

---

## Overall Verdict: PASS - Ready for Careers Fair

The site performed well under both **expected load** (19 concurrent users) and **2x stress load** (38 concurrent users) with zero failures.

---

## Test Scenarios

| Stage | Duration | Virtual Users | Purpose |
|-------|----------|---------------|---------|
| Warm up | 1 min | 0 → 5 | Gradual start |
| Ramp to expected load | 2 min | 5 → 19 | Match projected traffic |
| Sustain expected load | 5 min | 19 | Steady-state at expected usage |
| Ramp to 2x peak | 2 min | 19 → 38 | Stress test at double capacity |
| Sustain 2x peak | 3 min | 38 | Sustained stress |
| Ramp down | 2 min | 38 → 0 | Graceful cooldown |

Each virtual user simulates the full journey:
1. Landing page load
2. Questionnaire page load
3. Static assets (JS + CSS bundles)
4. Statistics API call
5. Fill questionnaire → Get matching roles API
6. View results → Generate & download PDF

---

## Reliability: EXCELLENT

| Metric | Result |
|--------|--------|
| Total requests | 5,103 |
| Failed requests | **0** (0.00%) |
| Checks passed | **6,809 / 6,809** (100%) |
| Thresholds breached | **0** |
| Complete user journeys | 561 |

---

## Response Times

### Per Endpoint

| Endpoint | Avg | Median | p90 | p95 | Max | Threshold | Status |
|----------|-----|--------|-----|-----|-----|-----------|--------|
| Landing Page | 771ms | 562ms | 1.03s | 1.38s | 16.1s | p95 < 3s | PASS |
| Questionnaire Page | 935ms | 664ms | 1.13s | 1.92s | 16.1s | p95 < 3s | PASS |
| Matching Roles API | 834ms | 674ms | 1.11s | 1.31s | 7.3s | p95 < 5s | PASS |
| Generate PDF | 468ms | 376ms | 599ms | 733ms | 6.8s | p95 < 10s | PASS |

### Overall HTTP

| Metric | Value |
|--------|-------|
| Avg response time | 803ms |
| Median response time | 620ms |
| p90 | 1.13s |
| p95 | 1.51s |
| Max | 19.3s |
| Request rate | 5.55 req/s |

---

## Checks Breakdown (All 100% Pass)

### 01 - Landing Page
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| landing page status 200 | 569 | 0 | 100% |
| landing page has content | 569 | 0 | 100% |

### 02 - Questionnaire Page
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| questionnaire page status 200 | 569 | 0 | 100% |

### 03 - Static Assets
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| asset loaded (JS + CSS) | 1,138 | 0 | 100% |

### 04 - Get Statistics
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| getCounts status 200 | 569 | 0 | 100% |
| getCounts has data | 569 | 0 | 100% |

### 05 - Get Matching Roles
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| getMatchingRoles status 200 | 568 | 0 | 100% |
| getMatchingRoles has roles | 568 | 0 | 100% |

### 06 - Generate PDF
| Check | Passes | Failures | Pass % |
|-------|--------|----------|--------|
| results page status 200 | 564 | 0 | 100% |
| generatePDF status 200 | 563 | 0 | 100% |
| generatePDF has response | 563 | 0 | 100% |

---

## Capacity Assessment

| Scenario | Concurrent Users | Equivalent Users/Hour | Status |
|----------|-----------------|----------------------|--------|
| Expected load (70% of 1,625/hr) | 19 | ~1,138 | PASS |
| 2x stress test | 38 | ~2,276 | PASS |
| Full capacity (100% of 1,625/hr) | 27 | ~1,625 | PASS (inferred) |

---

## Data Transfer

| Metric | Total | Rate |
|--------|-------|------|
| Data received | 1.58 GB | 1.72 MB/s |
| Data sent | 11.8 MB | 12.8 KB/s |

---

## Observations & Recommendations

### Positive Findings
1. **Zero errors** across all 5,103 requests even at 2x expected load
2. **PDF generation is fast** - avg 468ms, the fastest endpoint despite being compute-intensive
3. **Cloudflare CDN** is serving the site effectively with good caching
4. **Median response times are snappy** (376ms–674ms) - most users will have a smooth experience

### Areas to Monitor
1. **Occasional slow outliers** (max 16–19s): A small number of requests (<5%) had elevated response times during peak stress. This is acceptable but worth monitoring on event day.
2. **JS bundle size (1.4MB)**: On slower mobile networks, initial page load may be slow. Recommend ensuring reliable WiFi at Suntec venue, or advise users to load the app before entering the hall.
3. **No rate limiting observed**: The site accepted all requests without throttling — good for the event but consider adding protection against potential abuse.

---

## Conclusion

The Careers@Gov Booth Finder at https://find.careers.gov.sg is **ready for the Public Service Careers Fair on 18 April 2026**. It can comfortably handle the projected 13,000 visitors over 8 hours, even at 100% app adoption (not just the estimated 70%). The questionnaire flow and PDF download feature are both performant and reliable.

---

## Files

| File | Description |
|------|-------------|
| `load-test.js` | k6 load test script |
| `smoke-test.js` | k6 smoke test (single user validation) |
| `report.html` | Interactive HTML report with charts |
| `report.json` | Raw JSON metrics data |
| `load-test-report.md` | This report |
