/**
 * Exocortex — Proactive Cognitive Co-Processor
 * Background Service Worker (Manifest V3)
 */

const MAX_MEMORY_ITEMS = 25;
const NOTIFICATION_COOLDOWN_MS = 12000; // prevent spamming user on same page
const lastNotificationMap = new Map();

// Initialize Storage Defaults
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['settings', 'memory', 'insights']);
  if (!current.settings) {
    await chrome.storage.local.set({
      settings: {
        engineMode: 'hybrid', // 'hybrid' = local heuristics + AI if key exists, 'local' = heuristics only
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash',
        proactiveAlerts: true,
        privacyMode: false,
        pausedDomains: []
      },
      memory: [],
      insights: []
    });
  }
  console.log('[Exocortex] Cognitive Co-Processor Initialized.');
});

// Listen for messages from Content Scripts and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender.tab ? sender.tab.id : null;

  switch (message.type) {
    case 'PAGE_DIGEST_UPDATED':
      handlePageDigest(message.payload, senderTabId)
        .then(result => sendResponse({ status: 'ok', result }))
        .catch(err => sendResponse({ status: 'error', error: err.message }));
      return true; // Keep channel open for async response

    case 'TRIGGER_DEMO_ANALYSIS':
      handleDemoAnalysis(message.tabId)
        .then(result => sendResponse({ status: 'ok', result }))
        .catch(err => sendResponse({ status: 'error', error: err.message }));
      return true;

    case 'CLEAR_MEMORY':
      clearMemory().then(() => sendResponse({ status: 'cleared' }));
      return true;

    case 'GET_STATUS':
      getStatus().then(data => sendResponse(data));
      return true;

    default:
      sendResponse({ status: 'unknown_message' });
  }
});

/**
 * Handle incoming semantic digest of a webpage
 */
async function handlePageDigest(digest, tabId) {
  if (!digest || !digest.url) return;

  const storage = await chrome.storage.local.get(['settings', 'memory', 'insights']);
  const settings = storage.settings || {};
  const pausedDomains = settings.pausedDomains || [];

  const urlObj = new URL(digest.url);
  if (pausedDomains.includes(urlObj.hostname) || settings.privacyMode) {
    return { status: 'skipped_privacy' };
  }

  // Update Memory Buffer
  let memory = storage.memory || [];
  
  // Remove prior entry for same URL if exists, add fresh at front
  memory = memory.filter(m => m.url !== digest.url);
  const memoryItem = {
    id: 'mem_' + Date.now(),
    tabId,
    url: digest.url,
    domain: urlObj.hostname,
    title: digest.title || 'Untitled Page',
    timestamp: Date.now(),
    category: digest.category || 'general',
    prices: digest.prices || [],
    dates: digest.dates || [],
    times: digest.times || [],
    finePrintHazards: digest.finePrintHazards || [],
    keyClaims: digest.keyClaims || [],
    summary: digest.summary || ''
  };

  memory.unshift(memoryItem);
  if (memory.length > MAX_MEMORY_ITEMS) {
    memory = memory.slice(0, MAX_MEMORY_ITEMS);
  }
  await chrome.storage.local.set({ memory });

  // If proactive alerts are disabled, stop here
  if (settings.proactiveAlerts === false) {
    return { status: 'learning_silently' };
  }

  // Cooldown check for this tab
  const lastNotif = lastNotificationMap.get(tabId) || 0;
  if (Date.now() - lastNotif < NOTIFICATION_COOLDOWN_MS) {
    return { status: 'cooldown' };
  }

  // Run Cognitive Analysis: Find contradictions, mismatches, or hazards
  const insight = await analyzeCognitiveStream(memoryItem, memory.slice(1), settings);

  if (insight && tabId) {
    lastNotificationMap.set(tabId, Date.now());

    // Save insight to history
    let insights = storage.insights || [];
    insights.unshift({
      ...insight,
      id: 'ins_' + Date.now(),
      timestamp: Date.now(),
      targetUrl: digest.url,
      targetTitle: digest.title
    });
    if (insights.length > 50) insights = insights.slice(0, 50);
    await chrome.storage.local.set({ insights });

    // Send Whisper HUD alert to the active tab
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXOCORTEX_WHISPER',
        payload: insight
      });
    } catch (err) {
      console.warn('[Exocortex] Tab message failed (user may have navigated away):', err);
    }
  }

  return { status: 'analyzed', insightFound: !!insight };
}

/**
 * The Cognitive Reasoner
 * Combines Built-in Heuristics with LLM Synthesis
 */
async function analyzeCognitiveStream(currentPage, previousPages, settings) {
  // 1. FAST LOCAL HEURISTIC ANALYSIS (Always runs, zero latency, 100% private)
  const heuristicInsight = runHeuristicReasoning(currentPage, previousPages);
  if (heuristicInsight) {
    return heuristicInsight;
  }

  // 2. DEEP AI SYNTHESIS (Runs if Gemini API key is configured)
  if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
    try {
      const aiInsight = await runGeminiReasoning(currentPage, previousPages, settings.geminiApiKey, settings.geminiModel);
      if (aiInsight) {
        return aiInsight;
      }
    } catch (e) {
      console.error('[Exocortex] AI Analysis error:', e);
    }
  }

  return null;
}

/**
 * Built-in Heuristic Reasoner: Catches schedule clashes, price drops, traps
 */
function runHeuristicReasoning(current, history) {
  // A. Check for Fine-Print Hazards on current page (immediate blindspot warning)
  if (current.finePrintHazards && current.finePrintHazards.length > 0) {
    const hazard = current.finePrintHazards[0];
    return {
      type: 'HAZARD',
      badge: 'FINE-PRINT TRAP',
      title: 'Hidden Clause Detected',
      message: hazard.description,
      sourceExcerpt: hazard.snippet,
      severity: 'high',
      confidence: 0.94,
      suggestedAction: 'Review terms before agreeing'
    };
  }

  // B. Cross-Tab Schedule / Time Clashes (e.g. Travel / Booking / Flights vs Hotels)
  for (const prev of history) {
    // If one is travel/flight and the other is lodging/hotel
    const isTravelCross = (current.category === 'travel' && prev.category === 'travel') ||
                          (current.summary.toLowerCase().includes('flight') && prev.summary.toLowerCase().includes('hotel')) ||
                          (current.summary.toLowerCase().includes('hotel') && prev.summary.toLowerCase().includes('flight'));

    if (isTravelCross && current.times.length > 0 && prev.times.length > 0) {
      const currTime = current.times[0];
      const prevTime = prev.times[0];
      
      // Look for check-in vs arrival conflict hints
      if (current.summary.toLowerCase().includes('check-in') || prev.summary.toLowerCase().includes('flight')) {
        return {
          type: 'TIMELINE_CONFLICT',
          badge: 'SCHEDULE MISMATCH',
          title: 'Timing Clash with Previous Tab',
          message: `Current page specifies ${currTime}, but you viewed ${prev.title.slice(0, 30)}... which referenced ${prevTime}. Ensure arrival and check-in align.`,
          crossTab: {
            title: prev.title,
            url: prev.url
          },
          severity: 'medium',
          confidence: 0.88,
          suggestedAction: 'Verify arrival vs check-in buffer'
        };
      }
    }

    // C. Cross-Tab Price Discrepancy (e.g., viewed same/similar item at different prices)
    if (current.prices.length > 0 && prev.prices.length > 0) {
      const currPrice = current.prices[0];
      const prevPrice = prev.prices[0];

      // If price variance is significant on related products/services
      const titleWords = current.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const prevTitleWords = prev.title.toLowerCase().split(/\s+/);
      const sharedWords = titleWords.filter(w => prevTitleWords.includes(w));

      if (sharedWords.length >= 2 && Math.abs(currPrice.amount - prevPrice.amount) > 5) {
        if (currPrice.amount > prevPrice.amount) {
          const diff = Math.round(currPrice.amount - prevPrice.amount);
          return {
            type: 'PRICE_DISCREPANCY',
            badge: 'BETTER PRICE SEEN',
            title: `Cheaper Option on "${prev.title.slice(0, 25)}..."`,
            message: `You are looking at $${currPrice.amount}, but you saw this for $${prevPrice.amount} (~$${diff} less) in your previous tab.`,
            crossTab: {
              title: prev.title,
              url: prev.url
            },
            severity: 'high',
            confidence: 0.91,
            suggestedAction: 'Compare previous tab before paying'
          };
        }
      }
    }

    // D. Direct Contradictions in Policy / Promises
    const currentText = (current.summary + ' ' + current.keyClaims.join(' ')).toLowerCase();
    const prevText = (prev.summary + ' ' + prev.keyClaims.join(' ')).toLowerCase();

    if ((currentText.includes('non-refundable') || currentText.includes('no refunds')) &&
        (prevText.includes('free cancellation') || prevText.includes('money-back guarantee'))) {
      return {
        type: 'POLICY_CONTRADICTION',
        badge: 'POLICY CONTRADICTION',
        title: 'Conflicting Cancellation Policy',
        message: `This checkout states "Non-refundable", but the offer page on "${prev.domain}" promised Free Cancellation.`,
        crossTab: {
          title: prev.title,
          url: prev.url
        },
        severity: 'high',
        confidence: 0.95,
        suggestedAction: 'Take screenshot or demand clarification'
      };
    }
  }

  return null;
}

/**
 * Gemini Proactive Reasoning Engine
 */
async function runGeminiReasoning(current, history, apiKey, modelName = 'gemini-1.5-flash') {
  const recentHistory = history.slice(0, 4).map(h => ({
    title: h.title,
    domain: h.domain,
    summary: h.summary.slice(0, 300),
    prices: h.prices.map(p => p.raw).join(', '),
    claims: h.keyClaims.slice(0, 3)
  }));

  const prompt = `You are Exocortex, a real-time cognitive co-processor. Your job is to catch what the user missed across tabs and in fine print.
CURRENT TAB:
Title: ${current.title}
Domain: ${current.domain}
Summary: ${current.summary.slice(0, 500)}
Key Claims: ${current.keyClaims.join('; ')}
Prices: ${current.prices.map(p => p.raw).join(', ')}

RECENT PREVIOUS TABS IN MEMORY:
${JSON.stringify(recentHistory, null, 2)}

TASK:
Determine if there is a CRITICAL blindspot, contradiction, timeline clash, or hidden trap that the user needs to know RIGHT NOW.
If there is NOTHING critical or confidence is low, reply ONLY with: {"insightFound": false}

If an insight is worth interrupting the user, respond with ONLY valid JSON:
{
  "insightFound": true,
  "badge": "SHORT 2-3 WORD BADGE",
  "title": "Punchy Headline (max 7 words)",
  "message": "1 or 2 clear sentences explaining the insight faster and better than the user realized.",
  "suggestedAction": "Specific 3-5 word action advice",
  "severity": "high" | "medium"
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned status ${response.status}`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  const parsed = JSON.parse(rawText);
  if (!parsed.insightFound) return null;

  return {
    type: 'AI_SYNTHESIS',
    badge: parsed.badge || 'PROACTIVE INSIGHT',
    title: parsed.title,
    message: parsed.message,
    severity: parsed.severity || 'high',
    confidence: 0.96,
    suggestedAction: parsed.suggestedAction || 'Review details'
  };
}

/**
 * Demo trigger for instant live verification
 */
async function handleDemoAnalysis(tabId) {
  const demoInsight = {
    type: 'DEMO_INSIGHT',
    badge: 'CROSS-TAB CLASH DETECTED',
    title: 'Flight Lands After Check-In Closes',
    message: 'Your flight confirmation arrives at 10:45 PM, but this hotel front desk closes at 10:00 PM with no automated keybox.',
    crossTab: {
      title: 'Flight Booking Confirmation - Seat 14B',
      url: 'https://example.com/airline-itinerary'
    },
    sourceExcerpt: 'Front desk reception hours: 07:00 - 22:00 strictly.',
    severity: 'high',
    confidence: 0.98,
    suggestedAction: 'Request late check-in code now'
  };

  if (tabId) {
    await chrome.tabs.sendMessage(tabId, {
      type: 'EXOCORTEX_WHISPER',
      payload: demoInsight
    });
  }

  return demoInsight;
}

async function clearMemory() {
  await chrome.storage.local.set({ memory: [], insights: [] });
  lastNotificationMap.clear();
}

async function getStatus() {
  const data = await chrome.storage.local.get(['settings', 'memory', 'insights']);
  return {
    activeMemoryCount: (data.memory || []).length,
    recentInsightsCount: (data.insights || []).length,
    settings: data.settings || {}
  };
}
