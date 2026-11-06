# 🚀 Job Hunter & Auto-Apply Dashboard

An automated job search, CV matching, email notification, and 1-click auto-apply dashboard built with Node.js and modern Bootstrap 5.

---

## 🌟 What This System Does

1. **Daily / On-Demand Job Scraping**:
   * Scrapes & queries fresh listings (LinkedIn, Indeed, and direct feeds).
   * Ranks jobs based on your **CV**, preferred **roles**, and **location**.

2. **AI Fit & Gap Analysis**:
   * Generates a **Match Percentage** (e.g. 95% Fit).
   * Highlights **Why You Fit** and flags any **Skill Gaps**.
   * Drafts a tailored **Cover Letter** ready for submission.

3. **Email Notification with Magic Redirect**:
   * Sends an email notification to you with a direct magic link (`http://localhost:3000/?review=job-101` or your live URL).
   * Clicking the link opens your dashboard directly to that job's review modal on desktop or mobile.

4. **1-Click Review & Auto-Apply**:
   * Review the job description and cover letter.
   * Click **[ Approve & Auto-Apply ]**.
   * The status updates immediately to **"Applied"** and logs the applied timestamp.

5. **Organized Table Dashboard**:
   * Clean table view with search, filter tabs (*All*, *Pending Review*, *Applied*, *Dismissed*), and quick metrics.

---

## 📁 Project Structure

```
job-hunter-auto-apply/
├── package.json          # Node.js project manifest
├── server.js             # Standalone zero-dependency Node.js server & REST APIs
├── .gitignore            # Git ignore rules
├── .env.example          # Environment variables template
├── README.md             # Documentation & deployment guide
├── data/
│   ├── config.json       # User CV, target roles, email, live machine URL
│   └── jobs.json         # Jobs database & application history
└── public/
    ├── index.html        # Interactive Bootstrap 5 Dashboard
    ├── css/style.css     # Clean modern UI styling
    └── js/app.js         # Frontend controller (filters, auto-apply, modals)
```

---

## ⚡ Quick Start (Local Machine)

### 1. Open Terminal in this folder:
```powershell
cd c:\Users\Windows\Desktop\job-hunter-auto-apply
```

### 2. Start the Server:
```bash
node server.js
```

### 3. Open in Browser:
```
http://localhost:3000
```

---

## 🌐 Deploying to a Live Machine or VPS

Because this server has **zero external binary dependencies**, it runs out-of-the-box on any server (Ubuntu, Debian, Windows Server, Render, Railway, AWS):

```bash
# On your live server:
git clone <your-git-repo-url>
cd job-hunter-auto-apply
PORT=80 node server.js
```

In the dashboard **Settings & CV** modal, set your **Machine / Live URL** to your server domain (e.g., `https://my-job-hunter.com`). All future email notification links will direct straight to your live domain!

---

## 📦 Pushing to Git

To push this codebase to your own GitHub repository:

```bash
cd c:\Users\Windows\Desktop\job-hunter-auto-apply
git init
git add .
git commit -m "feat: initial commit for job-hunter auto-apply dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```
