/**
 * Exocortex — Content Perception, Ambient HUD & Autonomous Actuator
 * Capable of autonomous DOM execution, scraping, and form manipulation.
 */

(function () {
  if (window.__exocortex_injected) return;
  window.__exocortex_injected = true;

  let shadowRoot = null;
  let activeInsight = null;
  let currentDigest = null;
  let autoHideTimer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initAmbientHUD();
    extractAndReportPageDigest();
  }

  // Listen for Background & Popup Commands (Autonomous Execution)
  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXOCORTEX_WHISPER') {
        presentInsight(message.payload);
        sendResponse({ status: 'displayed' });
      } else if (message.type === 'EXECUTE_AUTONOMOUS_TASK') {
        runAutonomousTask(message.task, message.params)
          .then(result => sendResponse({ status: 'success', result }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true; // async
      }
      return true;
    });
  } catch (e) {}

  /**
   * AUTONOMOUS ACTUATOR ENGINE
   * Executes physical work on the webpage autonomously
   */
  async function runAutonomousTask(taskType, params = {}) {
    showAutopilotBanner(`🤖 Autopilot: Executing "${taskType}"...`);

    switch (taskType) {
      case 'EXTRACT_CSV':
        return await executeExtractToCSV();

      case 'HUNT_TRAPS':
        return await executeHuntAndHighlightTraps();

      case 'DECLINE_COOKIES':
        return await executeDismissCookieBanners();

      case 'AUTOFILL_FORM':
        return await executeAutoFillForm(params);

      case 'CUSTOM_COMMAND':
        return await executeCustomNaturalCommand(params.command);

      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
  }

  /**
   * Task 1: Autonomously extract table/card items and trigger CSV download
   */
  async function executeExtractToCSV() {
    const rows = [];
    rows.push(['Item / Title', 'Extracted Price / Value', 'Context']);

    // 1. Scan HTML tables
    const tableRows = document.querySelectorAll('table tr');
    tableRows.forEach(tr => {
      const cols = Array.from(tr.querySelectorAll('td, th')).map(c => (c.innerText || '').replace(/[\r\n,]/g, ' ').trim());
      if (cols.length >= 2) rows.push(cols);
    });

    // 2. Scan card listings or headings with adjacent prices
    if (rows.length <= 1) {
      const elements = document.querySelectorAll('h1, h2, h3, h4, p, div');
      const priceRegex = /(?:[\$\€\£\₹]|USD|EUR|GBP|INR)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i;
      
      elements.forEach(el => {
        const text = (el.innerText || '').trim();
        const match = text.match(priceRegex);
        if (match && text.length > 5 && text.length < 140) {
          const title = text.replace(match[0], '').trim() || 'Detected Item';
          rows.push([title.replace(/[\r\n,]/g, ' '), match[0], location.hostname]);
        }
      });
    }

    if (rows.length <= 1) {
      showAutopilotBanner('⚠️ No structured data or prices found to extract.');
      return { count: 0 };
    }

    // Deduplicate
    const uniqueCsvRows = Array.from(new Set(rows.map(r => r.join(','))));
    const csvContent = 'data:text/csv;charset=utf-8,' + uniqueCsvRows.join('\n');
    const encodedUri = encodeURI(csvContent);

    // Auto-trigger download
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `exocortex-extract-${location.hostname}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    showAutopilotBanner(`✓ Autopilot Done: Extracted ${uniqueCsvRows.length - 1} items to CSV!`);
    return { count: uniqueCsvRows.length - 1, filename: `exocortex-extract-${location.hostname}.csv` };
  }

  /**
   * Task 2: Autonomously hunt for sneaky fine-print, scroll to it, and highlight
   */
  async function executeHuntAndHighlightTraps() {
    const hazardRegex = /(?:non-refundable|no refunds?|automatically renews?|auto-renew|cancellation fee|restocking fee|mandatory arbitration|binding arbitration)/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    let foundCount = 0;
    const targets = [];

    while ((node = walker.nextNode())) {
      if (node.parentElement && !['SCRIPT', 'STYLE', 'EXOCORTEX-HUD-ROOT'].includes(node.parentElement.tagName)) {
        if (hazardRegex.test(node.textContent)) {
          targets.push(node.parentElement);
        }
      }
    }

    if (targets.length === 0) {
      showAutopilotBanner('✓ Autopilot Scan: No hidden traps or cancellation penalties found.');
      return { found: 0 };
    }

    // Highlight and scroll to first target
    targets.forEach(el => {
      foundCount++;
      el.style.backgroundColor = 'rgba(244, 63, 94, 0.35)';
      el.style.outline = '2px dashed #f43f5e';
      el.style.borderRadius = '4px';
      el.style.transition = 'all 0.5s ease';
    });

    targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    showAutopilotBanner(`⚠️ Autopilot Found ${foundCount} traps! Scrolled & highlighted in red.`);
    return { found: foundCount };
  }

  /**
   * Task 3: Autonomously find and dismiss cookie banners / GDPR popups
   */
  async function executeDismissCookieBanners() {
    const rejectButtons = [];
    const buttons = document.querySelectorAll('button, a, input[type="button"], div[role="button"]');
    const rejectKeywords = ['reject all', 'decline all', 'only necessary', 'strictly necessary', 'decline', 'reject', 'close', 'accept necessary'];

    buttons.forEach(btn => {
      const text = (btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase().trim();
      if (rejectKeywords.some(kw => text.includes(kw)) && text.length < 40) {
        rejectButtons.push(btn);
      }
    });

    if (rejectButtons.length > 0) {
      // Click the best match
      rejectButtons[0].click();
      showAutopilotBanner('✓ Autopilot Done: Dismissed cookie banner.');
      return { dismissed: true };
    }

    // Fallback: look for generic close icons (X) inside modals
    const closeButtons = document.querySelectorAll('[aria-label*="close" i], [title*="close" i], .close-btn, .modal-close');
    if (closeButtons.length > 0) {
      closeButtons[0].click();
      showAutopilotBanner('✓ Autopilot Done: Closed active overlay/banner.');
      return { dismissed: true };
    }

    showAutopilotBanner('✓ Autopilot: No active cookie banner detected.');
    return { dismissed: false };
  }

  /**
   * Task 4: Autonomously auto-fill form fields
   */
  async function executeAutoFillForm(customProfile = {}) {
    const profile = Object.assign({
      name: 'Alex Mercer',
      email: 'alex.mercer.test@gmail.com',
      phone: '+1 (555) 234-5678',
      address: '742 Evergreen Terrace',
      city: 'Springfield',
      zip: '97477',
      company: 'Exocortex Labs'
    }, customProfile);

    let filledCount = 0;
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea');

    inputs.forEach(input => {
      const name = (input.name || input.id || input.placeholder || input.getAttribute('aria-label') || '').toLowerCase();
      let valueToSet = null;

      if (name.includes('mail')) valueToSet = profile.email;
      else if (name.includes('phone') || name.includes('tel')) valueToSet = profile.phone;
      else if (name.includes('first') || name.includes('fname')) valueToSet = profile.name.split(' ')[0];
      else if (name.includes('last') || name.includes('lname')) valueToSet = profile.name.split(' ')[1] || 'Mercer';
      else if (name.includes('name')) valueToSet = profile.name;
      else if (name.includes('addr')) valueToSet = profile.address;
      else if (name.includes('city')) valueToSet = profile.city;
      else if (name.includes('zip') || name.includes('postal')) valueToSet = profile.zip;
      else if (name.includes('comp') || name.includes('org')) valueToSet = profile.company;

      if (valueToSet && !input.value) {
        input.focus();
        input.value = valueToSet;
        // Trigger realistic events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.style.border = '2px solid #10b981';
        filledCount++;
      }
    });

    showAutopilotBanner(`✓ Autopilot Done: Filled ${filledCount} form fields with profile.`);
    return { filled: filledCount };
  }

  /**
   * Task 5: Natural Language Web Commands (e.g. scroll, highlight, search)
   */
  async function executeCustomNaturalCommand(cmd) {
    if (!cmd) return;
    const lower = cmd.toLowerCase().trim();

    if (lower.includes('scroll to bottom')) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      showAutopilotBanner('✓ Autopilot: Scrolled to page bottom.');
    } else if (lower.includes('scroll to top')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showAutopilotBanner('✓ Autopilot: Scrolled to page top.');
    } else if (lower.includes('csv') || lower.includes('extract') || lower.includes('download')) {
      return await executeExtractToCSV();
    } else if (lower.includes('trap') || lower.includes('fine print') || lower.includes('terms')) {
      return await executeHuntAndHighlightTraps();
    } else if (lower.includes('cookie') || lower.includes('banner')) {
      return await executeDismissCookieBanners();
    } else if (lower.includes('fill') || lower.includes('form')) {
      return await executeAutoFillForm();
    } else {
      // General Keyword Highlighter
      const words = lower.replace(/highlight|find|search for/g, '').trim().split(/\s+/);
      const targetWord = words[0];
      if (targetWord && targetWord.length > 2) {
        const regex = new RegExp(targetWord, 'gi');
        let matches = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const elements = [];
        while ((node = walker.nextNode())) {
          if (node.parentElement && !['SCRIPT', 'STYLE', 'EXOCORTEX-HUD-ROOT'].includes(node.parentElement.tagName)) {
            if (regex.test(node.textContent)) elements.push(node.parentElement);
          }
        }
        elements.forEach(el => {
          matches++;
          el.style.backgroundColor = 'rgba(250, 204, 21, 0.4)';
          el.style.outline = '1px solid #eab308';
        });
        if (elements.length > 0) elements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        showAutopilotBanner(`✓ Autopilot Found & Highlighted ${matches} occurrences of "${targetWord}".`);
      } else {
        showAutopilotBanner(`✓ Autopilot executed: "${cmd}"`);
      }
    }
    return { command: cmd };
  }

  function showAutopilotBanner(text) {
    if (!shadowRoot) return;
    let banner = shadowRoot.getElementById('autopilot-live-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'autopilot-live-banner';
      banner.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95);
        color: #f8fafc;
        border: 1px solid #38bdf8;
        border-radius: 9999px;
        padding: 10px 24px;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(56, 189, 248, 0.3);
        z-index: 2147483647;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.3s ease;
      `;
      shadowRoot.appendChild(banner);
    }
    banner.innerText = text;
    banner.style.opacity = '1';

    setTimeout(() => {
      if (banner) banner.style.opacity = '0';
    }, 4500);
  }

  function initAmbientHUD() {
    if (!document.body) {
      setTimeout(initAmbientHUD, 200);
      return;
    }

    try {
      const host = document.createElement('exocortex-hud-root');
      host.id = 'exocortex-hud-root';
      host.style.all = 'initial';
      document.body.appendChild(host);

      shadowRoot = host.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color-scheme: dark; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        #exocortex-container { position: fixed; top: 24px; right: 24px; z-index: 2147483647; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none; user-select: none; }
        .ambient-pill { pointer-events: auto; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 9999px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45); transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .ambient-pill:hover { transform: translateY(-2px) scale(1.03); border-color: rgba(56, 189, 248, 0.8); }
        .pill-core { width: 9px; height: 9px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }
        .pill-core.alert { background: #f43f5e; box-shadow: 0 0 10px #f43f5e; }
        .pill-label { font-size: 11.5px; font-weight: 700; color: #f1f5f9; letter-spacing: 0.8px; }
        .pill-badge { background: #4f46e5; color: #fff; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 8px; }
        .insight-card { pointer-events: auto; position: relative; width: 380px; max-width: 90vw; margin-top: 10px; padding: 18px 20px; background: linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(26, 34, 52, 0.98) 100%); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.12); border-top: 2px solid #38bdf8; border-radius: 16px; box-shadow: 0 24px 50px rgba(0, 0, 0, 0.7); color: #f8fafc; display: none; opacity: 0; transform: translateY(-8px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .insight-card.visible { display: block; opacity: 1; transform: translateY(0); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .card-badge { display: inline-flex; align-items: center; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 3px 8px; border-radius: 6px; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); }
        .card-badge.high { background: rgba(244, 63, 94, 0.18); color: #fb7185; border-color: rgba(244, 63, 94, 0.4); }
        .close-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
        .card-title { font-size: 14.5px; font-weight: 700; line-height: 1.35; color: #ffffff; margin-bottom: 8px; }
        .card-body { font-size: 12px; line-height: 1.5; color: #cbd5e1; margin-bottom: 10px; }
        .xray-points { margin: 8px 0; display: flex; flex-direction: column; gap: 6px; }
        .xray-point { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #cbd5e1; line-height: 1.45; }
        .xray-bullet { color: #38bdf8; font-weight: bold; }
        .cross-tab-box { margin: 8px 0; padding: 8px 12px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border-left: 3px solid #38bdf8; font-size: 11.5px; color: #94a3b8; }
        .cross-tab-title { font-weight: 600; color: #e2e8f0; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .snippet-box { font-size: 11.5px; font-style: italic; color: #fca5a5; background: rgba(244, 63, 94, 0.12); padding: 8px 10px; border-radius: 6px; margin: 8px 0; border-left: 2px solid #f43f5e; }
        .card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
        .action-btn { font-size: 11.5px; font-weight: 700; padding: 6px 12px; border-radius: 8px; background: #4f46e5; color: #ffffff; border: none; cursor: pointer; }
        .action-btn:hover { background: #6366f1; }
        .dismiss-link { font-size: 11px; color: #64748b; cursor: pointer; }
        .dismiss-link:hover { color: #cbd5e1; }
      `;
      shadowRoot.appendChild(style);

      const container = document.createElement('div');
      container.id = 'exocortex-container';
      container.innerHTML = `
        <div class="ambient-pill" id="exo-pill" title="Click for Page X-Ray">
          <div class="pill-core" id="exo-core"></div>
          <span class="pill-label">EXOCORTEX</span>
          <span class="pill-badge" id="exo-badge" style="display:none;">0</span>
        </div>

        <div class="insight-card" id="exo-card">
          <div class="card-header">
            <span class="card-badge" id="card-badge">COGNITIVE X-RAY</span>
            <button class="close-btn" id="exo-close" title="Dismiss">✕</button>
          </div>
          <div class="card-title" id="card-title">Analyzing page...</div>
          <div class="card-body" id="card-body"></div>
          <div class="xray-points" id="xray-points"></div>
          <div class="snippet-box" id="snippet-box" style="display:none;"></div>
          <div class="cross-tab-box" id="cross-tab-box" style="display:none;">
            <div style="font-weight: 700; margin-bottom: 2px;">Cross-Tab Reference:</div>
            <div class="cross-tab-title" id="cross-tab-title"></div>
          </div>
          <div class="card-footer">
            <span class="dismiss-link" id="exo-dismiss">Close</span>
            <button class="action-btn" id="exo-action">Got it</button>
          </div>
        </div>
      `;

      shadowRoot.appendChild(container);

      const pill = shadowRoot.getElementById('exo-pill');
      const card = shadowRoot.getElementById('exo-card');
      const closeBtn = shadowRoot.getElementById('exo-close');
      const dismissLink = shadowRoot.getElementById('exo-dismiss');
      const actionBtn = shadowRoot.getElementById('exo-action');

      pill.addEventListener('click', () => {
        if (card.classList.contains('visible')) {
          hideInsightCard();
        } else {
          if (activeInsight) {
            presentInsight(activeInsight);
          } else {
            presentPageXRay();
          }
        }
      });

      closeBtn.addEventListener('click', hideInsightCard);
      dismissLink.addEventListener('click', hideInsightCard);
      actionBtn.addEventListener('click', hideInsightCard);
    } catch (e) {}
  }

  function presentPageXRay() {
    if (!shadowRoot || !currentDigest) return;

    const card = shadowRoot.getElementById('exo-card');
    const cardBadge = shadowRoot.getElementById('card-badge');
    const cardTitle = shadowRoot.getElementById('card-title');
    const cardBody = shadowRoot.getElementById('card-body');
    const pointsContainer = shadowRoot.getElementById('xray-points');
    const snippetBox = shadowRoot.getElementById('snippet-box');
    const crossTabBox = shadowRoot.getElementById('cross-tab-box');
    const actionBtn = shadowRoot.getElementById('exo-action');

    cardBadge.innerText = 'PAGE COGNITIVE X-RAY';
    cardBadge.className = 'card-badge';
    cardTitle.innerText = currentDigest.title ? currentDigest.title.slice(0, 45) + '...' : 'Current Page';
    
    const priceText = currentDigest.prices.length > 0 ? ` • Price: ${currentDigest.prices[0].raw}` : '';
    const readTime = Math.max(1, Math.round(currentDigest.wordCount / 200));
    cardBody.innerText = `Category: ${currentDigest.category.toUpperCase()} • ~${readTime} min read (${currentDigest.wordCount} words)${priceText}`;

    pointsContainer.innerHTML = '';
    const takeaways = currentDigest.keyTakeaways && currentDigest.keyTakeaways.length > 0
      ? currentDigest.keyTakeaways
      : [currentDigest.summary.slice(0, 160) + '...'];

    takeaways.slice(0, 3).forEach(pt => {
      const row = document.createElement('div');
      row.className = 'xray-point';
      row.innerHTML = `<span class="xray-bullet">⚡</span><span>${escapeHtml(pt)}</span>`;
      pointsContainer.appendChild(row);
    });

    if (currentDigest.finePrintHazards && currentDigest.finePrintHazards.length > 0) {
      snippetBox.style.display = 'block';
      snippetBox.innerText = `⚠️ Notice: "${currentDigest.finePrintHazards[0].snippet}"`;
    } else {
      snippetBox.style.display = 'none';
    }

    crossTabBox.style.display = 'none';
    actionBtn.innerText = 'Got it';
    card.classList.add('visible');
  }

  function presentInsight(insight) {
    if (!shadowRoot) return;
    activeInsight = insight;

    const core = shadowRoot.getElementById('exo-core');
    const badge = shadowRoot.getElementById('exo-badge');
    const card = shadowRoot.getElementById('exo-card');
    const cardBadge = shadowRoot.getElementById('card-badge');
    const cardTitle = shadowRoot.getElementById('card-title');
    const cardBody = shadowRoot.getElementById('card-body');
    const pointsContainer = shadowRoot.getElementById('xray-points');
    const snippetBox = shadowRoot.getElementById('snippet-box');
    const crossTabBox = shadowRoot.getElementById('cross-tab-box');
    const crossTabTitle = shadowRoot.getElementById('cross-tab-title');
    const actionBtn = shadowRoot.getElementById('exo-action');

    core.className = 'pill-core ' + (insight.severity === 'high' ? 'alert' : '');
    badge.style.display = 'inline-block';
    badge.innerText = '1';

    cardBadge.innerText = insight.badge || 'PROACTIVE ALERT';
    cardBadge.className = 'card-badge ' + (insight.severity === 'high' ? 'high' : '');
    cardTitle.innerText = insight.title || 'Attention Required';
    cardBody.innerText = insight.message || '';
    pointsContainer.innerHTML = '';

    if (insight.sourceExcerpt) {
      snippetBox.style.display = 'block';
      snippetBox.innerText = `"${insight.sourceExcerpt}"`;
    } else {
      snippetBox.style.display = 'none';
    }

    if (insight.crossTab && insight.crossTab.title) {
      crossTabBox.style.display = 'block';
      crossTabTitle.innerText = insight.crossTab.title;
    } else {
      crossTabBox.style.display = 'none';
    }

    actionBtn.innerText = insight.suggestedAction || 'Got it';
    card.classList.add('visible');

    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => { hideInsightCard(); }, 18000);
  }

  function hideInsightCard() {
    if (!shadowRoot) return;
    const card = shadowRoot.getElementById('exo-card');
    card.classList.remove('visible');
  }

  function extractAndReportPageDigest() {
    if (!location || !location.protocol) return;
    if (location.protocol.startsWith('chrome') || location.protocol.startsWith('edge') || location.protocol.startsWith('about')) return;

    setTimeout(() => {
      try {
        if (!chrome.runtime?.id) return;
        currentDigest = distillPage();
        chrome.runtime.sendMessage({
          type: 'PAGE_DIGEST_UPDATED',
          payload: currentDigest
        }).catch(() => {});
      } catch (err) {}
    }, 1200);
  }

  function distillPage() {
    const title = document.title || '';
    const url = window.location.href;

    if (!document.body) {
      return { title, url, category: 'general', prices: [], times: [], wordCount: 0, finePrintHazards: [], keyTakeaways: [], summary: '' };
    }

    let fullText = '';
    try {
      const clone = document.body.cloneNode(true);
      const removeSelectors = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'iframe', 'exocortex-hud-root'];
      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });
      fullText = (clone.innerText || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      fullText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    }

    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

    const prices = [];
    const priceRegex = /(?:[\$\€\£\₹]|USD|EUR|GBP|INR)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi;
    let priceMatch;
    let matchCount = 0;
    while ((priceMatch = priceRegex.exec(fullText)) !== null && matchCount < 5) {
      const raw = priceMatch[0];
      const amount = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) {
        prices.push({ raw, amount });
        matchCount++;
      }
    }

    const times = [];
    const timeRegex = /\b(?:(?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:AM|PM|am|pm)|(?:[01]?[0-9]|2[0-3]):[0-5][0-9])\b/g;
    let timeMatch;
    let timeCount = 0;
    while ((timeMatch = timeRegex.exec(fullText)) !== null && timeCount < 5) {
      times.push(timeMatch[0]);
      timeCount++;
    }

    const finePrintHazards = [];
    const hazardPatterns = [
      { regex: /non-refundable|no refunds?|strictly non-refundable/i, desc: 'Non-refundable policy applies.' },
      { regex: /automatically renews?|auto-renew|recurring billing/i, desc: 'Recurring subscription charges apply.' },
      { regex: /cancellation fee|cancellation penalty/i, desc: 'Cancellation penalties apply.' },
      { regex: /restocking fee/i, desc: 'Restocking fees apply on returns.' }
    ];

    for (const pat of hazardPatterns) {
      const m = fullText.match(pat.regex);
      if (m) {
        const snippetIndex = fullText.indexOf(m[0]);
        const snippet = fullText.substring(Math.max(0, snippetIndex - 30), Math.min(fullText.length, snippetIndex + 70));
        finePrintHazards.push({
          pattern: m[0],
          description: pat.desc,
          snippet: snippet.trim()
        });
        break;
      }
    }

    const keyTakeaways = [];
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(h => {
      const text = (h.innerText || '').trim();
      if (text.length > 15 && text.length < 120 && !keyTakeaways.includes(text)) {
        keyTakeaways.push(text);
      }
    });

    if (keyTakeaways.length < 3) {
      const paragraphs = document.querySelectorAll('p');
      for (const p of paragraphs) {
        const text = (p.innerText || '').trim();
        if (text.length > 50 && text.length < 200) {
          keyTakeaways.push(text);
          if (keyTakeaways.length >= 3) break;
        }
      }
    }

    let category = 'general';
    const lowerText = fullText.toLowerCase();
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('flight') || lowerUrl.includes('hotel') || lowerUrl.includes('booking') || lowerText.includes('check-in')) {
      category = 'travel';
    } else if (prices.length > 0 && (lowerText.includes('cart') || lowerText.includes('checkout') || lowerText.includes('buy now'))) {
      category = 'shopping';
    } else if (lowerUrl.includes('terms') || lowerUrl.includes('privacy') || lowerUrl.includes('agreement')) {
      category = 'legal';
    } else if (lowerUrl.includes('blog') || lowerUrl.includes('article') || lowerUrl.includes('news') || lowerUrl.includes('wiki')) {
      category = 'reading';
    }

    const summary = fullText.slice(0, 600);

    return {
      title,
      url,
      category,
      prices,
      times,
      wordCount,
      finePrintHazards,
      keyTakeaways: keyTakeaways.slice(0, 4),
      summary
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
