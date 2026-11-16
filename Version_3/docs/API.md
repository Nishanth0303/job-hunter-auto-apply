# JobHuntAI Version 3.0 — API Reference

## Base URLs
- **Local Development**: `http://localhost:3000`
- **Cloud Production**: `https://<your-service-name>.up.railway.app` (or Render / AWS)

## Authentication
Protected endpoints require either:
1. `Authorization: Bearer <JWT_TOKEN>`
2. `X-Admin-Key: <ADMIN_API_KEY>`

---

## Endpoints

### 1. Health Probe
- **Route**: `GET /health`
- **Access**: Public
- **Response**:
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "uptime": 142,
  "timestamp": "2026-11-13T21:40:00.000Z"
}
```

### 2. Active Top 20 Jobs
- **Route**: `GET /api/v1/jobs`
- **Access**: Public (Sanitized)
- **Query Parameters**:
  - `status`: `all`, `pending_review`, `applied`, `skipped`
  - `portal`: `LinkedIn`, `Naukri`, `Wellfound`, `Hirist`, etc.
- **Response**:
```json
{
  "total": 19,
  "jobs": [
    {
      "job_id": "job-123",
      "title": "PHP Developer (Laravel)",
      "company": "Tech Corp",
      "location": "Coimbatore",
      "match_score": 98,
      "matchTier": "Excellent Match",
      "freshness_label": "2d ago",
      "status": "pending_review",
      "url_verification_status": "VERIFIED_DIRECT_URL",
      "direct_job_post_url": "https://www.linkedin.com/jobs/view/...",
      "coverNote": "Dear Tech Corp Hiring Team..."
    }
  ]
}
```

### 3. Update Job Tracking Status
- **Route**: `PATCH /api/v1/jobs/:id/status`
- **Access**: Authenticated (Bearer Token or X-Admin-Key)
- **Payload**:
```json
{
  "status": "applied",
  "skipReason": null,
  "userNotes": "Submitted via company portal with PHP Developer resume."
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Job job-123 updated to status \"applied\"",
  "job": { ... }
}
```

### 4. Trigger Daily Hunting Scan
- **Route**: `POST /api/v1/scan/trigger`
- **Access**: Admin Authorization Required (`X-Admin-Key`)
- **Payload**:
```json
{
  "scanDate": "2026-11-13",
  "discoveredJobs": []
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Daily scan completed for 2026-11-13",
  "stats": {
    "totalTracked": 22,
    "newlyAdded": 0,
    "updatedExisting": 22,
    "totalEligible30Days": 19,
    "top20Count": 19
  },
  "backupCreated": "job_history_2026-11-13T..._pre-scan.json"
}
```

### 5. Check Scan Status & Locks
- **Route**: `GET /api/v1/scan/status`
- **Access**: Public
- **Response**:
```json
{
  "locked": false,
  "last_scan_date": "2026-11-13",
  "total_jobs_tracked": 22,
  "top20_count": 19
}
```

### 6. Create Backup Snapshot
- **Route**: `POST /api/v1/admin/backup`
- **Access**: Admin Authorization Required
- **Payload**: `{ "tag": "manual-backup" }`

### 7. List Backups
- **Route**: `GET /api/v1/admin/backups`
- **Access**: Admin Authorization Required

