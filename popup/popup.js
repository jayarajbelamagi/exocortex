/**
 * Exocortex — Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadStateAndMetrics();
  initSettings();
  initActionButtons();
});

/**
 * Tab Navigation
 */
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
 * Load Memory & Insights from Storage
 */
async function loadStateAndMetrics() {
  const data = await chrome.storage.local.get(['memory', 'insights', 'settings']);
  const memory = data.memory || [];
  const insights = data.insights || [];

  // Update Metrics
  document.getElementById('metric-memory').innerText = memory.length;
  document.getElementById('metric-insights').innerText = insights.length;

  // Render Insights Feed
  renderInsights(insights);

  // Render Memory Buffer
  renderMemory(memory);
}

function renderInsights(insights) {
  const feed = document.getElementById('insights-feed');
  const empty = document.getElementById('insights-empty');

  if (!insights || insights.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  feed.innerHTML = '';

  insights.slice(0, 15).forEach(ins => {
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
  list.innerHTML = '';

  if (!memory || memory.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Memory buffer is empty</p><small>Open any web page to begin indexing.</small></div>';
    return;
  }

  memory.forEach(mem => {
    const item = document.createElement('div');
    item.className = 'feed-item';

    const priceInfo = mem.prices && mem.prices.length > 0 ? `💰 ${mem.prices[0].raw}` : '';
    const timeInfo = mem.times && mem.times.length > 0 ? `🕒 ${mem.times[0]}` : '';

    item.innerHTML = `
      <div class="item-title">${escapeHtml(mem.title)}</div>
      <div class="item-desc" style="font-size:11px; color:#64748b;">${escapeHtml(mem.domain)} • ${formatTime(mem.timestamp)}</div>
      <div style="margin-top:4px; font-size:11px; color:#38bdf8;">
        ${priceInfo} ${timeInfo}
      </div>
    `;
    list.appendChild(item);
  });
}

/**
 * Settings Management
 */
async function initSettings() {
  const data = await chrome.storage.local.get(['settings']);
  const settings = data.settings || {};

  const engineMode = document.getElementById('engine-mode');
  const apiKeyInput = document.getElementById('gemini-api-key');
  const proactiveToggle = document.getElementById('proactive-toggle');
  const toggleKeyBtn = document.getElementById('btn-toggle-key');
  const saveBtn = document.getElementById('btn-save-settings');
  const feedback = document.getElementById('settings-feedback');

  if (settings.engineMode) engineMode.value = settings.engineMode;
  if (settings.geminiApiKey) apiKeyInput.value = settings.geminiApiKey;
  if (typeof settings.proactiveAlerts === 'boolean') {
    proactiveToggle.checked = settings.proactiveAlerts;
  }

  // Toggle API Key visibility
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.innerText = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.innerText = '👁️';
    }
  });

  // Save Settings
  saveBtn.addEventListener('click', async () => {
    const updated = {
      engineMode: engineMode.value,
      geminiApiKey: apiKeyInput.value.trim(),
      geminiModel: 'gemini-1.5-flash',
      proactiveAlerts: proactiveToggle.checked
    };

    await chrome.storage.local.set({ settings: updated });
    feedback.innerText = '✓ Settings saved securely';
    setTimeout(() => { feedback.innerText = ''; }, 2500);
  });
}

/**
 * Action Buttons (Demo Test & Clear Memory)
 */
function initActionButtons() {
  const demoBtn = document.getElementById('btn-demo-test');
  const clearBtn = document.getElementById('btn-clear-mem');

  // Trigger Demo Alert on Active Tab
  demoBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      alert('Open a regular webpage to test the HUD.');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'TRIGGER_DEMO_ANALYSIS',
        tabId: tab.id
      });
      window.close(); // Close popup so user sees the on-screen Whisper HUD!
    } catch (err) {
      console.error('Demo trigger failed:', err);
    }
  });

  // Clear Memory
  clearBtn.addEventListener('click', async () => {
    if (confirm('Wipe current cross-tab memory buffer and insights?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_MEMORY' });
      await loadStateAndMetrics();
    }
  });
}

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
