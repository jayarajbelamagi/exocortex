/**
 * Exocortex — Content Perception & Ambient HUD
 * Injected into active web pages. Uses Shadow DOM for total style isolation.
 */

(function () {
  // Prevent duplicate injection
  if (window.__exocortex_injected) return;
  window.__exocortex_injected = true;

  let shadowRoot = null;
  let activeInsight = null;
  let autoHideTimer = null;

  // Initialize UI & Perception
  initAmbientHUD();
  extractAndReportPageDigest();

  // Listen for messages from Background Service Worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXOCORTEX_WHISPER') {
      presentInsight(message.payload);
      sendResponse({ status: 'displayed' });
    }
  });

  /**
   * 1. Shadow DOM HUD Setup (Zero style bleeding)
   */
  function initAmbientHUD() {
    const host = document.createElement('exocortex-hud-root');
    host.style.all = 'initial';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    // Inject stylesheet
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/content.css');
    shadowRoot.appendChild(styleLink);

    // Build DOM structure
    const container = document.createElement('div');
    container.id = 'exocortex-container';
    container.innerHTML = `
      <div class="ambient-pill" id="exo-pill" title="Exocortex Active">
        <div class="pill-core" id="exo-core"></div>
        <span class="pill-label">EXOCORTEX</span>
        <span class="pill-badge" id="exo-badge" style="display:none;">0</span>
      </div>

      <div class="insight-card" id="exo-card">
        <div class="card-header">
          <span class="card-badge" id="card-badge">PROACTIVE INSIGHT</span>
          <button class="close-btn" id="exo-close" title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="card-title" id="card-title"></div>
        <div class="card-body" id="card-body"></div>
        <div class="snippet-box" id="snippet-box" style="display:none;"></div>
        <div class="cross-tab-box" id="cross-tab-box" style="display:none;">
          <div style="font-weight: 700; margin-bottom: 2px;">Cross-Tab Reference:</div>
          <div class="cross-tab-title" id="cross-tab-title"></div>
        </div>
        <div class="card-footer">
          <span class="dismiss-link" id="exo-dismiss">Dismiss</span>
          <button class="action-btn" id="exo-action">Got it</button>
        </div>
      </div>
    `;

    shadowRoot.appendChild(container);

    // Event Listeners
    const pill = shadowRoot.getElementById('exo-pill');
    const card = shadowRoot.getElementById('exo-card');
    const closeBtn = shadowRoot.getElementById('exo-close');
    const dismissLink = shadowRoot.getElementById('exo-dismiss');
    const actionBtn = shadowRoot.getElementById('exo-action');

    pill.addEventListener('click', () => {
      if (activeInsight) {
        card.classList.toggle('visible');
      } else {
        // Quick visual pulse if no active alert
        showTemporaryFeedback('Exocortex active & learning silently...');
      }
    });

    closeBtn.addEventListener('click', hideInsightCard);
    dismissLink.addEventListener('click', hideInsightCard);
    actionBtn.addEventListener('click', hideInsightCard);
  }

  /**
   * 2. Present an Insight via The Whisper HUD
   */
  function presentInsight(insight) {
    if (!shadowRoot) return;
    activeInsight = insight;

    const core = shadowRoot.getElementById('exo-core');
    const badge = shadowRoot.getElementById('exo-badge');
    const card = shadowRoot.getElementById('exo-card');
    const cardBadge = shadowRoot.getElementById('card-badge');
    const cardTitle = shadowRoot.getElementById('card-title');
    const cardBody = shadowRoot.getElementById('card-body');
    const snippetBox = shadowRoot.getElementById('snippet-box');
    const crossTabBox = shadowRoot.getElementById('cross-tab-box');
    const crossTabTitle = shadowRoot.getElementById('cross-tab-title');
    const actionBtn = shadowRoot.getElementById('exo-action');

    // Update pill appearance
    core.className = 'pill-core ' + (insight.severity === 'high' ? 'alert' : '');
    badge.style.display = 'inline-block';
    badge.innerText = '1';

    // Populate card details
    cardBadge.innerText = insight.badge || 'PROACTIVE ALERT';
    cardBadge.className = 'card-badge ' + (insight.severity === 'high' ? 'high' : '');
    cardTitle.innerText = insight.title || 'Attention Required';
    cardBody.innerText = insight.message || '';

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

    if (insight.suggestedAction) {
      actionBtn.innerText = insight.suggestedAction;
    } else {
      actionBtn.innerText = 'Got it';
    }

    // Smoothly reveal
    card.classList.add('visible');

    // Auto-collapse after 18 seconds unless hovered
    if (autoHideTimer) clearTimeout(autoHideTimer);
    autoHideTimer = setTimeout(() => {
      hideInsightCard();
    }, 18000);
  }

  function hideInsightCard() {
    if (!shadowRoot) return;
    const card = shadowRoot.getElementById('exo-card');
    card.classList.remove('visible');
  }

  function showTemporaryFeedback(msg) {
    const pill = shadowRoot.getElementById('exo-pill');
    const label = pill.querySelector('.pill-label');
    const orig = label.innerText;
    label.innerText = msg;
    setTimeout(() => { label.innerText = orig; }, 2500);
  }

  /**
   * 3. Intelligent DOM Perception & Distillation
   */
  function extractAndReportPageDigest() {
    // Avoid scraping internal or blank pages
    if (location.protocol.startsWith('chrome') || location.protocol.startsWith('edge')) return;

    // Wait for document to stabilize
    setTimeout(() => {
      try {
        const digest = distillPage();
        chrome.runtime.sendMessage({
          type: 'PAGE_DIGEST_UPDATED',
          payload: digest
        });
      } catch (err) {
        console.warn('[Exocortex] Perception digest error:', err);
      }
    }, 1200);
  }

  function distillPage() {
    const title = document.title || '';
    const url = window.location.href;

    // Clone body and strip noise
    const clone = document.body.cloneNode(true);
    const removeSelectors = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'iframe', 'exocortex-hud-root'];
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    const fullText = (clone.innerText || '').replace(/\s+/g, ' ').trim();

    // 1. Extract Price Entities
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

    // 2. Extract Times & Dates
    const times = [];
    const timeRegex = /\b(?:(?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:AM|PM|am|pm)|(?:[01]?[0-9]|2[0-3]):[0-5][0-9])\b/g;
    let timeMatch;
    let timeCount = 0;
    while ((timeMatch = timeRegex.exec(fullText)) !== null && timeCount < 5) {
      times.push(timeMatch[0]);
      timeCount++;
    }

    // 3. Scan for Fine-Print Hazards
    const finePrintHazards = [];
    const hazardPatterns = [
      { regex: /non-refundable|no refunds?|strictly non-refundable/i, desc: 'Non-refundable policy applies to this transaction.' },
      { regex: /automatically renews?|auto-renew|recurring billing/i, desc: 'Recurring subscription that will automatically charge after trial.' },
      { regex: /cancellation fee|cancellation penalty|cancel within (\d+) hours/i, desc: 'Cancellation penalties apply if modified late.' },
      { regex: /restocking fee of (\d+)%?/i, desc: 'Restocking fee charged on returns.' },
      { regex: /mandatory arbitration|waive your right to jury/i, desc: 'Legal terms waive right to trial or class action.' }
    ];

    for (const pat of hazardPatterns) {
      const m = fullText.match(pat.regex);
      if (m) {
        const snippetIndex = fullText.indexOf(m[0]);
        const snippet = fullText.substring(Math.max(0, snippetIndex - 40), Math.min(fullText.length, snippetIndex + 80));
        finePrintHazards.push({
          pattern: m[0],
          description: pat.desc,
          snippet: snippet.trim()
        });
        break; // Only alert the top hazard to avoid clutter
      }
    }

    // 4. Categorize Page Context
    let category = 'general';
    const lowerText = fullText.toLowerCase();
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('flight') || lowerUrl.includes('hotel') || lowerUrl.includes('booking') || lowerText.includes('check-in') || lowerText.includes('airline')) {
      category = 'travel';
    } else if (prices.length > 0 && (lowerText.includes('cart') || lowerText.includes('checkout') || lowerText.includes('buy now') || lowerText.includes('order total'))) {
      category = 'shopping';
    } else if (lowerUrl.includes('terms') || lowerUrl.includes('privacy') || lowerUrl.includes('agreement') || lowerText.includes('terms of service')) {
      category = 'legal';
    }

    // Distill clean summary snippet (first 600 chars)
    const summary = fullText.slice(0, 600);

    return {
      title,
      url,
      category,
      prices,
      times,
      finePrintHazards,
      summary
    };
  }
})();
