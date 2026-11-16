# JobHuntAI Version 3.0 — Architecture Specification

## Overview

JobHuntAI Version 3.0 is an intelligent, multi-agent job-hunting and candidate-matching workspace engineered specifically for **Nishanth R** (5 Years Backend Experience in PHP, Laravel 10, CodeIgniter 3/4, MySQL, and REST APIs).

Version 3.0 implements a **Hybrid Cloud Architecture** separating private backend operations from public static distribution.

---

## 1. Hybrid System Topology

```
+-----------------------------------------------------------------------------------+
|                        PRODUCTION CLOUD BACKEND (Node.js/Express)                  |
|                                                                                   |
|  - Cron Scheduler (06:00 AM + Every 3h)                                            |
|  - Agent 1: Discovery Harvester (8 India Portals)                                 |
|  - Agent 2: Vacancy & Company Validator                                           |
|  - Agent 5: Exact URL Verifier (Guaranteed direct vacancy links)                  |
|  - Two-Stage Pipeline (Hard 30-Day Freshness Gate -> Pure Relevance Ranking)      |
|  - Agent 3: Relevance Scorer & Variant Selector                                   |
|  - Concurrency Lock (.scan.lock) & Atomic JSON Storage (fs.renameSync)            |
|  - Automated Rolling Backups (data/backups/) with SHA-256 Checksums                |
|  - JWT Bearer Authentication & Rate Limiting                                      |
+----------------------------------------+------------------------------------------+
                                         |
                       Automated Sanitization Pipeline
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                     STATIC FRONTEND (GitHub Pages / CDN)                          |
|                                                                                   |
|  - Read-Only Top 20 Feed (frontend/public/data/jobs.json)                         |
|  - Fully Sanitized: Zero API keys, Masked Contact (r.***@gmail.com, +91 ********76)|
|  - Responsive Bootstrap 5 Dashboard                                              |
|  - Filter Bar: Today, Yesterday, 7d, 30d, All Historical                          |
|  - Mandatory User Confirmation for Application Submission                         |
|  - Preloaded Skip Reason Logger with "✅ Already applied" support                  |
|  - Day-by-Day Historical Snapshot Viewer                                          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Two-Stage Ingestion Pipeline

Freshness and match relevance are strictly decoupled into two distinct sequential stages:

### Stage 1: Mandatory Binary Eligibility Gate
A discovered vacancy must satisfy **both** conditions before being considered for the active Top 20:
1. **Direct Vacancy URL Verification**: Agent 5 assigns `VERIFIED_DIRECT_URL` or `VERIFIED_REDIRECT`. (Search pages, category feeds, and broken links are disqualified).
2. **Posting Freshness Gate**: Original posting age must be $\le 30\text{ days}$. Postings older than 30 days or with unverified (`UNKNOWN`) dates are disqualified from the Top 20.

Ineligible jobs are stored in `data/job_history.json` with status `ARCHIVED_DISQUALIFIED` for historical reference, but cannot enter the active Top 20.

### Stage 2: Pure Candidate Relevance Ranking
All eligible jobs are evaluated purely on candidate fit:

$$\text{Relevance Score} = (S_{\text{core}} \cdot 0.45) + (E_{\text{exp}} \cdot 0.25) + (D_{\text{dom}} \cdot 0.20) + (L_{\text{loc}} \cdot 0.10)$$

- **Core Skills (45%)**: PHP 8, Laravel 10, CodeIgniter 3/4, MySQL, REST APIs.
- **Experience (25%)**: 4–6 years bracket (Nishanth: 5.0 years).
- **Domain Alignment (20%)**: ERP, CRM, Billing Engines, E-commerce, Payment Gateways.
- **Location Preference (10%)**: Coimbatore (100%), Chennai/Bangalore/Remote (95%), Other (50%).

Eligible jobs are sorted by Relevance Score descending. The best 20 are selected. If fewer than 20 eligible jobs exist, only the eligible count is displayed (zero padding with stale jobs).

---

## 3. Data Integrity & Immutability Guarantees

1. **Automated Scan Idempotency**:
   - Automated scheduled scans never create duplicate records. Jobs are matched on canonical URL, job ID, and company + title.
   - Re-scanned jobs update `last_checked_date` but **NEVER reset** user statuses (`Applied`, `Interview`, `Skipped`, etc.) or user notes.
2. **Atomic Writes**:
   - All disk commits write to a temporary file (`.tmp`) and commit via `fs.renameSync()`, preventing corruptions on process termination.
3. **Concurrency Locking**:
   - `data/.scan.lock` stores process PID and timestamp. Prevents concurrent cron jobs from colliding. Automatically evicts stale locks older than 30 minutes.
4. **Disaster Recovery**:
   - Every write is preceded by a rolling snapshot in `data/backups/`. Companion `.sha256` files guarantee integrity.

