// JobHuntAI Auto-Apply Assistant - Content Script for Nishanth R
(function () {
  const CANDIDATE = {
    name: "Nishanth R",
    email: "r.nishanth2004@gmail.com",
    phone: "8220607076",
    experienceYears: "5",
    currentLocation: "Coimbatore, Tamil Nadu",
    portfolioUrl: "https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html",
    linkedinUrl: "https://linkedin.com/in/rnishanth2004",
    coverNote: `Dear Hiring Team,

I am writing to apply for this engineering role. With 5 years of specialized experience in PHP, Laravel (including Laravel 10), and CodeIgniter (3/4), I have engineered high-volume ERP, CRM, and billing applications at Icore Software Technologies and Rk Creators.

My technical core includes database normalization and indexing in MySQL, scalable RESTful API design, and third-party payment gateway integrations.

Why I am a strong fit:
• 5 years production PHP/Laravel development
• Robust database architecture and query optimization in MySQL
• End-to-end ERP, CRM, and billing logic execution
• Clean architecture, Git version control, and dependable communication

Portfolio: https://nishanth0303.github.io/Nishanth-portfolio/php-dev.html
LinkedIn: https://linkedin.com/in/rnishanth2004

Best regards,
Nishanth R
Phone: +91 8220607076
Email: r.nishanth2004@gmail.com
Location: Coimbatore, Tamil Nadu (Available for Remote India)`
  };

  function createFloatingAssistant() {
    if (document.getElementById('jobhunt-ai-floating-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'jobhunt-ai-floating-bar';
    bar.innerHTML = `
      <div style="position: fixed; top: 16px; right: 20px; z-index: 9999999; background: #0f172a; color: #fff; padding: 12px 18px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; display: flex; align-items: center; gap: 12px; border: 1px solid #334155;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #22c55e;"></span>
          <strong>JobHuntAI Auto-Apply:</strong>
          <span style="color: #94a3b8;">Nishanth R (5 Yrs PHP/Laravel)</span>
        </div>
        <button id="jobhunt-autofill-btn" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12px;">
          ⚡ Auto-Fill &amp; Apply
        </button>
        <button id="jobhunt-close-bar-btn" style="background: transparent; color: #94a3b8; border: none; font-size: 16px; cursor: pointer;">✕</button>
      </div>
    `;
    document.body.appendChild(bar);

    document.getElementById('jobhunt-close-bar-btn').onclick = () => bar.remove();
    document.getElementById('jobhunt-autofill-btn').onclick = triggerAutoApply;
  }

  function triggerAutoApply() {
    const host = window.location.hostname;
    let applied = false;

    // 1. WELLFOUND (AngelList)
    if (host.includes('wellfound.com')) {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = CANDIDATE.coverNote;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Find the Apply button on Wellfound
      const buttons = Array.from(document.querySelectorAll('button'));
      const applyBtn = buttons.find(b => b.innerText.trim() === 'Apply' || b.innerText.trim().toLowerCase().includes('apply to'));
      if (applyBtn) {
        applyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        applyBtn.click();
        showNotification("✅ Cover note filled & Apply button clicked on Wellfound!");
        applied = true;
      }
    }

    // 2. NAUKRI
    else if (host.includes('naukri.com')) {
      const applyBtn = document.querySelector('.apply-button') || document.querySelector('#apply-button') || Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.trim().toLowerCase() === 'apply');
      if (applyBtn) {
        applyBtn.click();
        showNotification("✅ Apply triggered on Naukri!");
        applied = true;
      }
    }

    // 3. LINKEDIN
    else if (host.includes('linkedin.com')) {
      const easyApplyBtn = document.querySelector('.jobs-apply-button') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Easy Apply') || b.innerText.trim() === 'Apply');
      if (easyApplyBtn) {
        easyApplyBtn.click();
        showNotification("✅ Easy Apply opened on LinkedIn!");
        applied = true;
      }
    }

    // 4. INDEED
    else if (host.includes('indeed.com')) {
      const applyBtn = document.querySelector('#indeedApplyButton') || document.querySelector('.ia-JobComponent-applyButton') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('apply now'));
      if (applyBtn) {
        applyBtn.click();
        showNotification("✅ Apply triggered on Indeed!");
        applied = true;
      }
    }

    // 5. CUTSHORT / INSTAHYRE / FOUNDIT / HIRIST
    else {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const applyBtn = buttons.find(b => {
        const text = b.innerText.trim().toLowerCase();
        return text === 'apply' || text === 'quick apply' || text.includes('apply now');
      });
      if (applyBtn) {
        applyBtn.click();
        showNotification("✅ Apply button clicked on job portal!");
        applied = true;
      }
    }

    if (!applied) {
      showNotification("📋 Cover note copied to clipboard! Paste with Ctrl+V into the form.");
      navigator.clipboard.writeText(CANDIDATE.coverNote).catch(() => {});
    }
  }

  function showNotification(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 99999999; background: #15803d; color: #fff; padding: 14px 20px; border-radius: 8px; font-weight: 600; font-family: sans-serif; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // Auto-run if URL contains #auto-apply
  window.addEventListener('load', () => {
    createFloatingAssistant();
    if (window.location.hash.includes('auto-apply')) {
      setTimeout(triggerAutoApply, 1200);
    }
  });

  // Re-check on dynamic navigation
  setTimeout(createFloatingAssistant, 2000);
})();
