# EXOCORTEX — Proactive Cognitive Co-Processor

> *"An ambient intelligence that connects dots across tabs, catches hidden traps, and surfaces proactive insights faster than you realize them."*

---

## ⚡ What Makes It "Full Proof" & Revolutionary

Traditional AI assistants wait for you to ask questions. **Exocortex is proactive:**
1. **Shadow DOM HUD ("The Whisper"):** Injected via a closed Shadow Root. Zero styling interference from any website.
2. **Cross-Tab Semantic Memory:** Watches your session across tabs and identifies timeline clashes, conflicting terms, and price variations.
3. **Fine-Print Radar:** Scans agreements, checkouts, and cancellation clauses to flag traps (*"non-refundable"*, *"auto-renews after 7 days"*, *"restocking fee"*) before you click Buy.
4. **Dual Engine (Heuristics + Gemini AI):** Works instantly out of the box with zero setup, with optional Google Gemini API support for deep semantic synthesis.
5. **100% Sovereign Privacy:** No cloud telemetry. All session memory is stored locally in your browser and wiped at any time.

---

## 🚀 How to Install & Load (Takes 30 Seconds)

1. Open **Google Chrome**, **Microsoft Edge**, or **Brave**.
2. Navigate to:
   * Chrome: `chrome://extensions/`
   * Edge: `edge://extensions/`
   * Brave: `brave://extensions/`
3. Toggle on **Developer mode** (top-right corner switch).
4. Click **Load unpacked** (top-left button).
5. Select this folder:
   ```
   C:\Users\ubela\.gemini\antigravity\scratch\exocortex-extension
   ```
6. Pin **Exocortex** to your browser toolbar!

---

## 🧪 How to Test It Live

### Option A: Instant 1-Click Demo
1. Open any regular website (e.g. `https://en.wikipedia.org` or any news site).
2. Click the **Exocortex** icon in your browser toolbar.
3. Click **⚡ Test Demo Alert**.
4. Watch the sleek floating **Whisper HUD** pop out on your screen!

### Option B: Realistic Cross-Tab Timeline Clash
1. Open `demo-pages/flight.html` in Tab 1 (shows flight arriving at 22:45 PM).
2. Open `demo-pages/hotel.html` in Tab 2 (shows hotel check-in strictly closing at 22:00 PM and non-refundable clause).
3. Notice how Exocortex flags the fine-print trap and connects the dots between the two tabs!

---

## 🛠 Project Structure

```
exocortex-extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── icons/                     # Crisp generated PNG icons (16, 32, 48, 128)
├── background/
│   └── service-worker.js      # Memory ring buffer, reasoning engine, cross-tab coordinator
├── content/
│   ├── content.js             # Intelligent DOM distillation & Shadow DOM HUD injection
│   └── content.css            # Futuristic glassmorphic HUD styling
├── popup/
│   ├── popup.html             # High-end dashboard deck
│   ├── popup.css              # Cyber-slate aesthetic theme
│   └── popup.js               # Memory inspector, metrics, settings & live triggers
└── demo-pages/
    ├── flight.html            # Test Tab 1: Confirmed late flight
    └── hotel.html             # Test Tab 2: Clashing hotel check-in
```
