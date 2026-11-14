/**
 * Exocortex — Proactive Cognitive Co-Processor & Autonomous Dispatcher
 * Background Service Worker (Manifest V3)
 */

const MAX_MEMORY_ITEMS = 30;
const NOTIFICATION_COOLDOWN_MS = 10000;
const lastNotificationMap = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const current = await chrome.storage.local.get(['settings', 'memory', 'insights']);
    if (!current.settings) {
      await chrome.storage.local.set({
        settings: {
          engineMode: 'hybrid',
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
  } catch (e) {}
  console.log('[Exocortex] Autonomous Engine Initialized.');
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderTabId = sender.tab ? sender.tab.id : null;

  try {
    switch (message.type) {
      case 'DISPATCH_CROSS_TAB_COMMAND':
        handleCrossTabCommand(message.command)
          .then(result => sendResponse({ status: 'success', result }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'PAGE_DIGEST_UPDATED':
        handlePageDigest(message.payload, senderTabId)
          .then(result => sendResponse({ status: 'ok', result }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'SYNTHESIZE_OPEN_TABS':
        synthesizeOpenTabs()
          .then(result => sendResponse({ status: 'ok', synthesis: result }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'QUERY_MEMORY':
        queryMemory(message.query)
          .then(results => sendResponse({ status: 'ok', results }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'TRIGGER_DEMO_ANALYSIS':
        handleDemoAnalysis(message.tabId)
          .then(result => sendResponse({ status: 'ok', result }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'CLEAR_MEMORY':
        clearMemory()
          .then(() => sendResponse({ status: 'cleared' }))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      case 'GET_STATUS':
        getStatus()
          .then(data => sendResponse(data))
          .catch(err => sendResponse({ status: 'error', error: err.message }));
        return true;

      default:
        sendResponse({ status: 'unknown_message' });
    }
  } catch (err) {
    sendResponse({ status: 'error', error: err.message });
  }
  return true;
});

/**
 * Superpower: Cross-Service Natural Language Command Dispatcher
 * Understands:
 * - "open whatsapp n text pratyush Hello"
 * - "open gmail and email john@test.com meeting at 5"
 * - "open youtube and search lofi beats"
 * - "open amazon and search mechanical keyboard"
 */
async function handleCrossTabCommand(commandText) {
  if (!commandText) throw new Error('No command provided');
  const cmd = commandText.trim();
  const lower = cmd.toLowerCase();

  // 1. WhatsApp Intent
  // e.g. "open whatsapp n text pratyush Hello" or "whatsapp text mom I am on my way"
  const waMatch = cmd.match(/(?:open\s+)?whatsapp.*?(?:text|msg|message|send)\s+([a-zA-Z0-9_\s]+?)\s+(?:saying\s+|that\s+)?(.+)$/i);
  if (waMatch) {
    const contact = waMatch[1].trim();
    const messageText = waMatch[2].trim();
    return await dispatchWhatsAppAction(contact, messageText);
  }

  // 2. Gmail Intent
  // e.g. "open gmail and email user@gmail.com Hello there"
  const gmailMatch = cmd.match(/(?:open\s+)?(?:gmail|mail).*?(?:email|compose|send)\s+([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)?\s*(.*)$/i);
  if (gmailMatch) {
    const to = gmailMatch[1] || '';
    const body = encodeURIComponent(gmailMatch[2] || '');
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&body=${body}`;
    const tab = await chrome.tabs.create({ url });
    return { app: 'Gmail', action: 'opened_compose', tabId: tab.id };
  }

  // 3. YouTube Intent
  // e.g. "open youtube and search coldplay"
  const ytMatch = cmd.match(/(?:open\s+)?youtube.*?(?:search|play|find)\s+(.+)$/i);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    const tab = await chrome.tabs.create({ url: `https://www.youtube.com/results?search_query=${query}` });
    return { app: 'YouTube', action: 'searched', query: ytMatch[1], tabId: tab.id };
  }

  // 4. Amazon Intent
  const amzMatch = cmd.match(/(?:open\s+)?amazon.*?(?:search|find|buy)\s+(.+)$/i);
  if (amzMatch) {
    const query = encodeURIComponent(amzMatch[1].trim());
    const tab = await chrome.tabs.create({ url: `https://www.amazon.com/s?k=${query}` });
    return { app: 'Amazon', action: 'searched', query: amzMatch[1], tabId: tab.id };
  }

  // Fallback: Send to active tab's actuator
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.id) {
    return await chrome.tabs.sendMessage(activeTab.id, {
      type: 'EXECUTE_AUTONOMOUS_TASK',
      task: 'CUSTOM_COMMAND',
      params: { command: cmd }
    });
  }

  throw new Error(`Could not parse command intent: "${cmd}"`);
}

/**
 * Dispatcher for WhatsApp Web
 */
async function dispatchWhatsAppAction(contact, messageText) {
  // Check if WhatsApp Web tab is already open
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find(t => t.url && t.url.includes('web.whatsapp.com'));

  if (existingTab && existingTab.id) {
    // Focus existing tab
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }

    // Send action
    try {
      await chrome.tabs.sendMessage(existingTab.id, {
        type: 'EXECUTE_WHATSAPP_ACTION',
        contact,
        messageText
      });
      return { status: 'sent_to_existing_tab', contact, messageText };
    } catch (e) {
      // Content script might need a moment
    }
  }

  // If tab not open, stage pending action in storage and create tab
  await chrome.storage.local.set({
    pendingWhatsAppAction: { contact, messageText, timestamp: Date.now() }
  });

  const newTab = await chrome.tabs.create({ url: 'https://web.whatsapp.com' });
  return { status: 'opened_whatsapp_tab', contact, messageText, tabId: newTab.id };
}

async function handlePageDigest(digest, tabId) {
  if (!digest || !digest.url) return;

  const storage = await chrome.storage.local.get(['settings', 'memory', 'insights']);
  const settings = storage.settings || {};
  const pausedDomains = settings.pausedDomains || [];

  let hostname = '';
  try {
    hostname = new URL(digest.url).hostname;
  } catch (e) {
    hostname = 'unknown';
  }

  if (pausedDomains.includes(hostname) || settings.privacyMode) {
    return { status: 'skipped_privacy' };
  }

  let memory = storage.memory || [];
  memory = memory.filter(m => m.url !== digest.url);

  const memoryItem = {
    id: 'mem_' + Date.now(),
    tabId,
    url: digest.url,
    domain: hostname,
    title: digest.title || 'Untitled Page',
    timestamp: Date.now(),
    category: digest.category || 'general',
    prices: digest.prices || [],
    dates: digest.dates || [],
    times: digest.times || [],
    finePrintHazards: digest.finePrintHazards || [],
    keyClaims: digest.keyClaims || [],
    keyTakeaways: digest.keyTakeaways || [],
    summary: digest.summary || ''
  };

  memory.unshift(memoryItem);
  if (memory.length > MAX_MEMORY_ITEMS) {
    memory = memory.slice(0, MAX_MEMORY_ITEMS);
  }
  await chrome.storage.local.set({ memory });

  if (settings.proactiveAlerts === false || !tabId) {
    return { status: 'learning_silently' };
  }

  const lastNotif = lastNotificationMap.get(tabId) || 0;
  if (Date.now() - lastNotif < NOTIFICATION_COOLDOWN_MS) {
    return { status: 'cooldown' };
  }

  const insight = await analyzeCognitiveStream(memoryItem, memory.slice(1), settings);

  if (insight && tabId) {
    lastNotificationMap.set(tabId, Date.now());

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

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXOCORTEX_WHISPER',
        payload: insight
      });
    } catch (err) {}
  }

  return { status: 'analyzed', insightFound: !!insight };
}

async function synthesizeOpenTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const storage = await chrome.storage.local.get(['memory', 'settings']);
  const memory = storage.memory || [];
  const settings = storage.settings || {};

  const tabUrls = new Set(tabs.map(t => t.url));
  const activeTabsMemory = memory.filter(m => tabUrls.has(m.url) || tabs.some(t => t.title === m.title));

  if (activeTabsMemory.length === 0) {
    return {
      title: "No Analyzed Tabs in Current Session",
      summary: "Browse a few pages or articles to build context, then click Synthesize again.",
      points: []
    };
  }

  if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
    try {
      return await generateGeminiTabSynthesis(activeTabsMemory, settings.geminiApiKey, settings.geminiModel);
    } catch (err) {
      console.warn('Gemini synthesis failed, using local engine:', err);
    }
  }

  return generateLocalTabSynthesis(activeTabsMemory);
}

function generateLocalTabSynthesis(items) {
  const totalTabs = items.length;
  const categories = [...new Set(items.map(i => i.category))];
  const allPrices = items.flatMap(i => i.prices.map(p => ({ ...p, source: i.title })));
  const allHazards = items.flatMap(i => i.finePrintHazards.map(h => ({ ...h, source: i.domain })));
  const allClaims = items.flatMap(i => (i.keyTakeaways || []).map(t => ({ text: t, source: i.domain })));

  let summary = `Cross-analyzed ${totalTabs} active tabs (${categories.join(', ')}).`;
  const points = [];

  if (allPrices.length > 1) {
    allPrices.sort((a, b) => a.amount - b.amount);
    const min = allPrices[0];
    const max = allPrices[allPrices.length - 1];
    points.push(`Price Variance: Lowest is ${min.raw} on "${min.source.slice(0, 20)}...", highest is ${max.raw} (Diff: $${Math.round(max.amount - min.amount)}).`);
  }

  if (allHazards.length > 0) {
    points.push(`Active Warnings: ${allHazards.length} fine-print restrictions or cancellation clauses detected across these pages.`);
  }

  if (allClaims.length > 0) {
    points.push(`Consensus Point: ${allClaims[0].text}`);
    if (allClaims.length > 1) {
      points.push(`Alternative Perspective: ${allClaims[1].text}`);
    }
  }

  const tabBreakdowns = items.slice(0, 6).map(item => ({
    title: item.title,
    domain: item.domain,
    takeaways: item.keyTakeaways && item.keyTakeaways.length > 0 ? item.keyTakeaways.slice(0, 2) : [item.summary.slice(0, 100) + '...']
  }));

  return {
    title: `Multi-Tab Synthesis (${totalTabs} Tabs)`,
    summary,
    points,
    tabBreakdowns
  };
}

async function generateGeminiTabSynthesis(items, apiKey, modelName = 'gemini-1.5-flash') {
  const context = items.map((item, idx) => `[Tab ${idx + 1}] ${item.title} (${item.domain})\nTakeaways: ${(item.keyTakeaways || []).join('; ')}\nPrices: ${item.prices.map(p => p.raw).join(', ')}\nSummary: ${item.summary.slice(0, 300)}`).join('\n\n');

  const prompt = `You are Exocortex. Provide an executive multi-tab synthesis:
1. Compare differences, contradictions, or pricing across these tabs.
2. What is the consensus or best recommendation?
3. What is the hidden catch or trap?

Tabs data:
${context}

Respond with ONLY valid JSON:
{
  "title": "Clear Synthesis Headline",
  "summary": "1-2 sentence executive overview comparing the tabs",
  "points": ["Point 1", "Point 2", "Point 3"],
  "tabBreakdowns": [
    { "title": "Tab Title", "domain": "domain.com", "takeaways": ["Key point 1"] }
  ]
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) return null;
  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;
  return JSON.parse(rawText);
}

async function queryMemory(queryString) {
  if (!queryString || !queryString.trim()) return [];
  const query = queryString.toLowerCase().trim();

  const storage = await chrome.storage.local.get(['memory']);
  const memory = storage.memory || [];

  const results = [];
  for (const item of memory) {
    let score = 0;
    const searchable = `${item.title} ${item.domain} ${item.summary} ${(item.keyTakeaways || []).join(' ')} ${item.prices.map(p => p.raw).join(' ')}`.toLowerCase();

    const terms = query.split(/\s+/).filter(t => t.length > 2);
    for (const term of terms) {
      if (searchable.includes(term)) score += 1;
    }

    if (score > 0) {
      results.push({
        title: item.title,
        domain: item.domain,
        url: item.url,
        matchSnippet: extractMatchSnippet(searchable, terms[0]),
        prices: item.prices,
        score
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 6);
}

function extractMatchSnippet(text, term) {
  if (!term) return text.slice(0, 120);
  const idx = text.indexOf(term);
  if (idx === -1) return text.slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 80);
  return '...' + text.substring(start, end).trim() + '...';
}

function runHeuristicReasoning(current, history) {
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

  for (const prev of history) {
    const isTravelCross = (current.category === 'travel' && prev.category === 'travel') ||
                          (current.summary.toLowerCase().includes('flight') && prev.summary.toLowerCase().includes('hotel')) ||
                          (current.summary.toLowerCase().includes('hotel') && prev.summary.toLowerCase().includes('flight'));

    if (isTravelCross && current.times.length > 0 && prev.times.length > 0) {
      const currTime = current.times[0];
      const prevTime = prev.times[0];
      if (current.summary.toLowerCase().includes('check-in') || prev.summary.toLowerCase().includes('flight')) {
        return {
          type: 'TIMELINE_CONFLICT',
          badge: 'SCHEDULE MISMATCH',
          title: 'Timing Clash with Previous Tab',
          message: `Current page specifies ${currTime}, but you viewed "${prev.title.slice(0, 25)}..." which referenced ${prevTime}. Ensure arrival and check-in align.`,
          crossTab: { title: prev.title, url: prev.url },
          severity: 'medium',
          confidence: 0.88,
          suggestedAction: 'Verify arrival vs check-in buffer'
        };
      }
    }

    if (current.prices.length > 0 && prev.prices.length > 0) {
      const currPrice = current.prices[0];
      const prevPrice = prev.prices[0];
      const titleWords = current.title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const prevTitleWords = prev.title.toLowerCase().split(/\s+/);
      const sharedWords = titleWords.filter(w => prevTitleWords.includes(w));

      if (sharedWords.length >= 2 && Math.abs(currPrice.amount - prevPrice.amount) > 5) {
        if (currPrice.amount > prevPrice.amount) {
          const diff = Math.round(currPrice.amount - prevPrice.amount);
          return {
            type: 'PRICE_DISCREPANCY',
            badge: 'BETTER PRICE SEEN',
            title: `Cheaper on "${prev.title.slice(0, 22)}..."`,
            message: `Current is $${currPrice.amount}, but you saw this for $${prevPrice.amount} (~$${diff} less) in your previous tab.`,
            crossTab: { title: prev.title, url: prev.url },
            severity: 'high',
            confidence: 0.91,
            suggestedAction: 'Check previous tab before paying'
          };
        }
      }
    }
  }

  return null;
}

async function analyzeCognitiveStream(currentPage, previousPages, settings) {
  const heuristicInsight = runHeuristicReasoning(currentPage, previousPages);
  if (heuristicInsight) return heuristicInsight;

  if (settings.geminiApiKey && settings.geminiApiKey.trim() !== '') {
    try {
      const aiInsight = await runGeminiReasoning(currentPage, previousPages, settings.geminiApiKey, settings.geminiModel);
      if (aiInsight) return aiInsight;
    } catch (e) {
      console.error('[Exocortex] AI Analysis error:', e);
    }
  }
  return null;
}

async function runGeminiReasoning(current, history, apiKey, modelName = 'gemini-1.5-flash') {
  const recentHistory = history.slice(0, 4).map(h => ({
    title: h.title,
    domain: h.domain,
    summary: h.summary.slice(0, 250),
    prices: h.prices.map(p => p.raw).join(', ')
  }));

  const prompt = `You are Exocortex. Flag any critical blindspots, contradictions, or hidden traps the user missed across tabs.
CURRENT TAB:
${current.title} (${current.domain})
Summary: ${current.summary.slice(0, 400)}
Takeaways: ${(current.keyTakeaways || []).join('; ')}
Prices: ${current.prices.map(p => p.raw).join(', ')}

PREVIOUS TABS:
${JSON.stringify(recentHistory, null, 2)}

If nothing critical, reply ONLY: {"insightFound": false}
If critical, reply ONLY valid JSON:
{
  "insightFound": true,
  "badge": "2-3 WORDS BADGE",
  "title": "Headline (max 7 words)",
  "message": "1-2 punchy sentences explaining the insight faster and better than user understood.",
  "suggestedAction": "Specific action advice",
  "severity": "high" | "medium"
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) return null;
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
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXOCORTEX_WHISPER',
        payload: demoInsight
      });
    } catch (e) {}
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
