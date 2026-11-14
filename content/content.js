/**
 * Exocortex — Content Perception & Ambient HUD
 * Injected into active web pages. Uses Shadow DOM for total style isolation.
 */

(function () {
  if (window.__exocortex_injected) return;
  window.__exocortex_injected = true;

  let shadowRoot = null;
  let activeInsight = null;
  let currentDigest = null;
  let autoHideTimer = null;

  initAmbientHUD();
  extractAndReportPageDigest();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXOCORTEX_WHISPER') {
      presentInsight(message.payload);
      sendResponse({ status: 'displayed' });
    }
  });

  function initAmbientHUD() {
    const host = document.createElement('exocortex-hud-root');
    host.style.all = 'initial';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/content.css');
    shadowRoot.appendChild(styleLink);

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
          <button class="close-btn" id="exo-close" title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
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

    // Clicking the ambient pill opens the Cognitive X-Ray of the current page!
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
  }

  /**
   * Superpower 1: Instant Page Cognitive X-Ray (On any webpage!)
   */
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
    
    // Status text
    const priceText = currentDigest.prices.length > 0 ? `💰 Price detected: ${currentDigest.prices[0].raw}` : '';
    const readTime = Math.max(1, Math.round(currentDigest.wordCount / 200));
    cardBody.innerText = `Category: ${currentDigest.category.toUpperCase()} • ~${readTime} min read (${currentDigest.wordCount} words). ${priceText}`;

    // Takeaways
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

    // Fine print check
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
    if (location.protocol.startsWith('chrome') || location.protocol.startsWith('edge')) return;

    setTimeout(() => {
      try {
        currentDigest = distillPage();
        chrome.runtime.sendMessage({
          type: 'PAGE_DIGEST_UPDATED',
          payload: currentDigest
        });
      } catch (err) {
        console.warn('[Exocortex] Perception digest error:', err);
      }
    }, 1000);
  }

  function distillPage() {
    const title = document.title || '';
    const url = window.location.href;

    const clone = document.body.cloneNode(true);
    const removeSelectors = ['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'iframe', 'exocortex-hud-root'];
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    const fullText = (clone.innerText || '').replace(/\s+/g, ' ').trim();
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

    // Prices
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

    // Times & Dates
    const times = [];
    const timeRegex = /\b(?:(?:1[0-2]|0?[1-9]):[0-5][0-9]\s*(?:AM|PM|am|pm)|(?:[01]?[0-9]|2[0-3]):[0-5][0-9])\b/g;
    let timeMatch;
    let timeCount = 0;
    while ((timeMatch = timeRegex.exec(fullText)) !== null && timeCount < 5) {
      times.push(timeMatch[0]);
      timeCount++;
    }

    // Fine-Print Hazards
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

    // Key Takeaways Extraction from Headings & Lead Paragraphs
    const keyTakeaways = [];
    const headings = document.querySelectorAll('h1, h2, h3');
    headings.forEach(h => {
      const text = (h.innerText || '').trim();
      if (text.length > 15 && text.length < 120 && !keyTakeaways.includes(text)) {
        keyTakeaways.push(text);
      }
    });

    // If headings are sparse, extract strong sentences
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
