/**
 * Exocortex — Popup Controller (Enhanced Multi-Tab Synthesis, X-Ray & Cross-App Autopilot)
 */

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initAutopilot();
  initOmnibar();
  initSynthesisAction();
  await loadStateAndMetrics();
  await loadActivePageXRay();
  initSettings();
  initActionButtons();
});

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = 'tab-' + btn.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

/**
 * Superpower: Autonomous Autopilot Actuator & Cross-App Agent
 */
function initAutopilot() {
  const runBtn = document.getElementById('btn-run-command');
  const input = document.getElementById('autopilot-input');
  const statusEl = document.getElementById('autopilot-status');
  const chips = document.querySelectorAll('.chip');

  const actExtractCsv = document.getElementById('act-extract-csv');
  const actHuntTraps = document.getElementById('act-hunt-traps');
  const actDeclineCookies = document.getElementById('act-decline-cookies');
  const actFillForm = document.getElementById('act-fill-form');

  // Execute Cross-App Natural Command (WhatsApp, Gmail, YouTube, etc.)
  const executeCommand = async (cmd) => {
    if (!cmd || !cmd.trim()) return;
    statusEl.style.display = 'block';
    statusEl.innerText = `🤖 Autopilot: Processing "${cmd}"...`;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DISPATCH_CROSS_TAB_COMMAND',
        command: cmd
      });

      if (response && response.status === 'success') {
        const r = response.result || {};
        if (r.status === 'opened_whatsapp_tab' || r.status === 'sent_to_existing_tab') {
          statusEl.innerText = `🚀 Switched to WhatsApp Web! Look at the top of your WhatsApp tab to see the live Autopilot steps executing.`;
        } else if (r.app) {
          statusEl.innerText = `✓ Autopilot: Initiated ${r.app} task!`;
        } else {
          statusEl.innerText = `✓ Autopilot task executing on active page!`;
        }
      } else {
        statusEl.innerText = `✓ Executed command on active page.`;
      }

      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 6000);
    } catch (err) {
      statusEl.innerText = `Notice: ${err.message}`;
    }
  };

  // Execute Page-level Task
  const dispatchPageTask = async (taskType, params = {}) => {
    statusEl.style.display = 'block';
    statusEl.innerText = `🤖 Autopilot: Running "${taskType}" on page...`;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        statusEl.innerText = '⚠️ Please open a regular webpage first.';
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        statusEl.innerText = '⚠️ Automation not allowed on internal browser settings.';
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_AUTONOMOUS_TASK',
        task: taskType,
        params
      });

      statusEl.innerText = `✓ Task executed successfully on page!`;
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 4000);
    } catch (err) {
      statusEl.innerText = `Task sent. Please refresh the page if loaded before extension.`;
    }
  };

  if (runBtn && input) {
    runBtn.addEventListener('click', () => executeCommand(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeCommand(input.value);
    });
  }

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd;
      if (input) input.value = cmd;
      executeCommand(cmd);
    });
  });

  if (actExtractCsv) actExtractCsv.addEventListener('click', () => dispatchPageTask('EXTRACT_CSV'));
  if (actHuntTraps) actHuntTraps.addEventListener('click', () => dispatchPageTask('HUNT_TRAPS'));
  if (actDeclineCookies) actDeclineCookies.addEventListener('click', () => dispatchPageTask('DECLINE_COOKIES'));
  if (actFillForm) actFillForm.addEventListener('click', () => dispatchPageTask('AUTOFILL_FORM'));
}

function safeGetDomain(url) {
  if (!url) return 'Unknown';
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol;
  } catch (e) {
    return 'Webpage';
  }
}

async function loadActivePageXRay() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs.length > 0 ? tabs[0] : null;
    if (!tab || !tab.url) return;

    const domain = safeGetDomain(tab.url);
    const data = await chrome.storage.local.get(['memory']);
    const memory = data.memory || [];
    const current = memory.find(m => m.url === tab.url) || {
      title: tab.title || 'Current Webpage',
      domain: domain,
      category: 'general',
      summary: 'Page currently open in active tab.',
      keyTakeaways: [tab.title || 'Browsing active tab'],
      prices: [],
      finePrintHazards: []
    };

    const titleEl = document.getElementById('xray-tab-title');
    const catEl = document.getElementById('xray-tab-category');
    const metaEl = document.getElementById('xray-tab-meta');
    const takeawaysEl = document.getElementById('xray-takeaways');
    const trapSection = document.getElementById('xray-traps-section');
    const trapText = document.getElementById('xray-trap-text');

    if (titleEl) titleEl.innerText = current.title || 'Untitled Page';
    if (catEl) catEl.innerText = (current.category || 'GENERAL').toUpperCase();
    
    const priceStr = current.prices && current.prices.length > 0 ? ` • Price: ${current.prices[0].raw}` : '';
    if (metaEl) metaEl.innerText = `${current.domain}${priceStr}`;

    if (takeawaysEl) {
      takeawaysEl.innerHTML = '';
      const takeaways = current.keyTakeaways && current.keyTakeaways.length > 0
        ? current.keyTakeaways
        : [current.summary.slice(0, 160) + '...'];

      takeaways.slice(0, 3).forEach(pt => {
        const item = document.createElement('div');
        item.className = 'takeaway-item';
        item.innerText = pt;
        takeawaysEl.appendChild(item);
      });
    }

    if (trapSection && trapText) {
      if (current.finePrintHazards && current.finePrintHazards.length > 0) {
        trapSection.style.display = 'block';
        trapText.innerText = current.finePrintHazards[0].snippet;
      } else {
        trapSection.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Page X-Ray load warning:', err);
  }
}

function initSynthesisAction() {
  const synthBtn = document.getElementById('btn-synthesize');
  const synthBox = document.getElementById('synthesis-output');
  const loadingEl = document.getElementById('synthesis-loading');
  const resultEl = document.getElementById('synthesis-result');

  if (!synthBtn) return;

  synthBtn.addEventListener('click', async () => {
    synthBox.style.display = 'block';
    loadingEl.style.display = 'block';
    resultEl.style.display = 'none';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SYNTHESIZE_OPEN_TABS' });
      const synth = response.synthesis;

      loadingEl.style.display = 'none';
      resultEl.style.display = 'block';

      let pointsHtml = '';
      if (synth.points && synth.points.length > 0) {
        pointsHtml = `<div class="synthesis-points">` +
          synth.points.map(p => `<div class="synthesis-point">${escapeHtml(p)}</div>`).join('') +
          `</div>`;
      }

      let breakdownHtml = '';
      if (synth.tabBreakdowns && synth.tabBreakdowns.length > 0) {
        breakdownHtml = `<div style="margin-top:8px; font-size:10.5px; color:#94a3b8;"><strong>Tab Breakdown:</strong>` +
          synth.tabBreakdowns.map(t => `<div style="margin-top:3px;">• <strong style="color:#e2e8f0;">${escapeHtml(t.domain)}:</strong> ${escapeHtml(t.takeaways[0] || '')}</div>`).join('') +
          `</div>`;
      }

      resultEl.innerHTML = `
        <div class="synthesis-title">${escapeHtml(synth.title || 'Cross-Tab Synthesis')}</div>
        <div class="synthesis-summary">${escapeHtml(synth.summary || '')}</div>
        ${pointsHtml}
        ${breakdownHtml}
      `;
    } catch (err) {
      loadingEl.innerText = 'Synthesis failed. Ensure multiple tabs are open.';
    }
  });
}

function initOmnibar() {
  const input = document.getElementById('omni-query');
  const btn = document.getElementById('omni-btn');
  const resultsBox = document.getElementById('search-results');
  if (!input || !btn) return;

  const executeSearch = async () => {
    const q = input.value.trim();
    if (!q) {
      resultsBox.style.display = 'none';
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'QUERY_MEMORY', query: q });
      const results = response.results || [];

      resultsBox.style.display = 'block';
      if (results.length === 0) {
        resultsBox.innerHTML = '<div style="font-size:11px; color:#64748b; padding:4px;">No matching tab or clause found.</div>';
        return;
      }

      resultsBox.innerHTML = results.map(r => `
        <div class="search-result-item">
          <div class="search-result-title">${escapeHtml(r.title.slice(0, 35))}... (${escapeHtml(r.domain)})</div>
          <div class="search-result-snippet">${escapeHtml(r.matchSnippet)}</div>
        </div>
      `).join('');
    } catch (err) {
      console.warn('Query failed:', err);
    }
  };

  btn.addEventListener('click', executeSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSearch();
  });
}

async function loadStateAndMetrics() {
  try {
    const data = await chrome.storage.local.get(['memory', 'insights']);
    const memory = data.memory || [];
    const insights = data.insights || [];

    const metricMem = document.getElementById('metric-memory');
    if (metricMem) metricMem.innerText = memory.length;
    renderInsights(insights);
    renderMemory(memory);
  } catch (e) {
    console.warn('State load warning:', e);
  }
}

function renderInsights(insights) {
  const feed = document.getElementById('insights-feed');
  const empty = document.getElementById('insights-empty');
  if (!feed) return;

  if (!insights || insights.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  feed.innerHTML = '';

  insights.slice(0, 10).forEach(ins => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
      <span class="item-badge ${ins.severity === 'high' ? 'high' : ''}">${escapeHtml(ins.badge || 'INSIGHT')}</span>
      <div class="item-title">${escapeHtml(ins.title || 'Cross-Tab Synthesis')}</div>
      <div class="item-desc">${escapeHtml(ins.message || '')}</div>
      <div class="item-meta">
        <span>${formatTime(ins.timestamp)}</span>
        <span>${escapeHtml(ins.suggestedAction || 'Review')}</span>
      </div>
    `;
    feed.appendChild(item);
  });
}

function renderMemory(memory) {
  const list = document.getElementById('memory-list');
  if (!list) return;
  list.innerHTML = '';

  if (!memory || memory.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Memory buffer is empty</p><small>Open any web page to index.</small></div>';
    return;
  }

  memory.forEach(mem => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    const priceInfo = mem.prices && mem.prices.length > 0 ? `💰 ${mem.prices[0].raw}` : '';

    item.innerHTML = `
      <div class="item-title">${escapeHtml(mem.title)}</div>
      <div class="item-desc" style="font-size:10.5px; color:#64748b;">${escapeHtml(mem.domain)} • ${formatTime(mem.timestamp)}</div>
      <div style="margin-top:3px; font-size:10.5px; color:#38bdf8;">${priceInfo}</div>
    `;
    list.appendChild(item);
  });
}

function initSettings() {
  chrome.storage.local.get(['settings']).then(data => {
    const settings = data.settings || {};
    const engineMode = document.getElementById('engine-mode');
    const apiKeyInput = document.getElementById('gemini-api-key');
    const proactiveToggle = document.getElementById('proactive-toggle');
    const toggleKeyBtn = document.getElementById('btn-toggle-key');
    const saveBtn = document.getElementById('btn-save-settings');
    const feedback = document.getElementById('settings-feedback');

    if (settings.engineMode && engineMode) engineMode.value = settings.engineMode;
    if (settings.geminiApiKey && apiKeyInput) apiKeyInput.value = settings.geminiApiKey;
    if (typeof settings.proactiveAlerts === 'boolean' && proactiveToggle) proactiveToggle.checked = settings.proactiveAlerts;

    if (toggleKeyBtn && apiKeyInput) {
      toggleKeyBtn.addEventListener('click', () => {
        apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
        toggleKeyBtn.innerText = apiKeyInput.type === 'password' ? '👁️' : '🔒';
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({
          settings: {
            engineMode: engineMode.value,
            geminiApiKey: apiKeyInput.value.trim(),
            geminiModel: 'gemini-1.5-flash',
            proactiveAlerts: proactiveToggle.checked
          }
        });
        if (feedback) {
          feedback.innerText = '✓ Settings saved securely';
          setTimeout(() => { feedback.innerText = ''; }, 2000);
        }
      });
    }
  }).catch(() => {});
}

function initActionButtons() {
  const demoBtn = document.getElementById('btn-demo-test');
  const clearBtn = document.getElementById('btn-clear-mem');

  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;

        if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
          alert('Please switch to a normal webpage (e.g. wikipedia.org or google.com) to test the floating HUD.');
          return;
        }

        await chrome.runtime.sendMessage({ type: 'TRIGGER_DEMO_ANALYSIS', tabId: tab.id });
        window.close();
      } catch (e) {
        console.warn('Demo trigger warning:', e);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Clear session memory buffer?')) {
        await chrome.runtime.sendMessage({ type: 'CLEAR_MEMORY' });
        await loadStateAndMetrics();
        await loadActivePageXRay();
      }
    });
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
