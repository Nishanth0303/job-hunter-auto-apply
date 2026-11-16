# JobHuntAI Version 3.0 — Deployment & Operations Guide

## 1. Cloud Backend Deployment

The backend is fully containerized and provider-independent. It can run on **Railway**, **Render**, **AWS ECS / App Runner**, or any Docker-capable VPS.

### Option A: Railway (Recommended)
1. Fork or push the repository to GitHub.
2. In Railway Dashboard, select **New Project** -> **Deploy from GitHub repo**.
3. Set the Root Directory to: `Version_3`.
4. Configure Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `JWT_SECRET`: Generate a secure 64-char hex string (`openssl rand -hex 32`)
   - `ADMIN_API_KEY`: Generate a secure admin key
   - `ALLOWED_ORIGINS`: `https://nishanth0303.github.io,http://localhost:3000`
5. Railway automatically builds the Dockerfile and starts the container.
6. Verify deployment by visiting: `https://<your-app>.up.railway.app/health`.

### Option B: Render
1. Create a **Web Service** pointing to the repository.
2. Build Command: `cd Version_3/backend && npm install --omit=dev`
3. Start Command: `cd Version_3/backend && node src/server.js`
4. Add environment variables as listed above.

---

## 2. Static Frontend Deployment (GitHub Pages)

The frontend is located at `Version_3/frontend/public/` and requires no build step.

1. Ensure the sanitized public feed is updated:
   ```bash
   node Version_3/scripts/sanitize-feed.js
   ```
2. Copy the contents of `Version_3/frontend/public/` into your GitHub Pages deployment branch or directory.
3. Access the dashboard at:
   `https://nishanth0303.github.io/job-hunter-auto-apply/`
4. The dashboard automatically operates in **Privacy-Safe Static Mode** (reading `data/jobs.json`). When configured with the Cloud Backend URL, it seamlessly transitions into **Interactive Cloud Mode**.

---

## 3. Disaster Recovery & Backup Restoration

### Automatic Pre-Write Snapshots
Before any disk write occurs, a snapshot is saved to `Version_3/data/backups/`.

### Manual Backup Creation
```bash
node Version_3/scripts/backup-restore.js --backup --tag=pre-deployment
```

### Listing Available Snapshots
```bash
node Version_3/scripts/backup-restore.js --list
```

### Snapshot Restoration (with SHA-256 Checksum Validation)
```bash
node Version_3/scripts/backup-restore.js --restore=job_history_2026-11-13T..._pre-scan.json
```
The restore script automatically takes a safety backup of the current state, verifies the SHA-256 checksum of the target file, and atomically restores `data/job_history.json`.

