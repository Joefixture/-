// ==UserScript==
// @name         哔哩哔哩 · 屏蔽词一键同步云端
// @namespace    https://bilibili.com/
// @version      1.2.0
// @description  自动点击视频页左侧所有屏蔽词的「云同步」按钮，无需逐个手动点击
// @author       Claude
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/*
// @match        https://www.bilibili.com/list/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SYNC_BTN_SELECTOR = '.bpx-player-block-list-sync';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  GM_addStyle(`
    #bbb-fab {
      position: fixed;
      bottom: 32px; right: 32px; z-index: 99999;
      background: linear-gradient(135deg, #fb7299, #d44c72);
      color: #fff; border: none; border-radius: 50px;
      padding: 12px 20px; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      box-shadow: 0 6px 24px rgba(251,114,153,.45);
      transition: transform .18s, box-shadow .18s;
      font-family: "PingFang SC", "HarmonyOS Sans SC", sans-serif;
    }
    #bbb-fab:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(251,114,153,.55); }

    #bbb-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0,0,0,.55); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
    }
    #bbb-panel {
      background: #fff; border-radius: 18px;
      width: 400px; max-width: 92vw;
      box-shadow: 0 24px 60px rgba(0,0,0,.22); overflow: hidden;
      font-family: "PingFang SC", "HarmonyOS Sans SC", sans-serif;
      animation: bbbPop .22s cubic-bezier(.16,1,.3,1);
    }
    @keyframes bbbPop {
      from { opacity:0; transform: scale(.93) translateY(14px) }
      to   { opacity:1; transform: none }
    }
    #bbb-header {
      background: linear-gradient(135deg, #fb7299, #d44c72);
      padding: 20px 22px 16px; color: #fff;
      display: flex; align-items: flex-start; justify-content: space-between;
    }
    #bbb-header h2 { margin: 0; font-size: 16px; font-weight: 700; }
    #bbb-header p  { margin: 5px 0 0; font-size: 12px; opacity: .85; }
    #bbb-close {
      background: rgba(255,255,255,.22); border: none; color: #fff;
      border-radius: 50%; width: 28px; height: 28px; cursor: pointer;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background .15s; margin-left: 12px;
    }
    #bbb-close:hover { background: rgba(255,255,255,.38); }
    #bbb-body { padding: 20px 22px 22px; }
    #bbb-info {
      background: #fff8fa; border: 1.5px solid #ffd6e3;
      border-radius: 10px; padding: 13px 15px;
      font-size: 13px; color: #444; margin-bottom: 16px; line-height: 1.75;
    }
    #bbb-info strong { color: #fb7299; font-size: 20px; }
    .bbb-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 16px; font-size: 13px; color: #666;
    }
    #bbb-speed { flex: 1; accent-color: #fb7299; }
    #bbb-speed-val { color: #fb7299; font-weight: 700; min-width: 44px; text-align: right; }
    #bbb-progress { display: none; margin-bottom: 14px; }
    #bbb-bar-track { height: 7px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
    #bbb-bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #fb7299, #d44c72);
      border-radius: 99px; transition: width .3s ease;
    }
    #bbb-bar-text { font-size: 12px; color: #999; text-align: right; margin-top: 5px; }
    #bbb-log {
      max-height: 100px; overflow-y: auto;
      background: #fafafa; border-radius: 8px;
      padding: 8px 10px; font-size: 11.5px;
      display: none; margin-bottom: 14px; line-height: 1.9;
      font-family: Consolas, Menlo, monospace;
    }
    #bbb-log .ok   { color: #52c41a; }
    #bbb-log .err  { color: #ff4d4f; }
    #bbb-log .info { color: #aaa; }
    .bbb-actions { display: flex; gap: 10px; }
    #bbb-start {
      flex: 1; padding: 12px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #fb7299, #d44c72);
      color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
      box-shadow: 0 3px 12px rgba(251,114,153,.35);
      transition: opacity .15s, transform .15s;
    }
    #bbb-start:hover:not(:disabled) { transform: translateY(-1px); opacity: .92; }
    #bbb-start:disabled { opacity: .45; cursor: not-allowed; transform: none; }
    #bbb-rescan {
      padding: 12px 16px; border: 2px solid #f0f0f0; border-radius: 10px;
      background: #fff; color: #888; font-size: 13px; cursor: pointer;
      transition: border-color .15s, color .15s; white-space: nowrap;
    }
    #bbb-rescan:hover:not(:disabled) { border-color: #fb7299; color: #fb7299; }
    #bbb-rescan:disabled { opacity: .4; cursor: not-allowed; }
  `);

  // [修复2] 用 getBoundingClientRect 替代 offsetParent，避免 fixed 元素误判
  function scanButtons() {
    return Array.from(document.querySelectorAll(SYNC_BTN_SELECTOR))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
  }

  function buildUI() {
    // [Gemini修复2] 防止重复注入：若悬浮按钮已存在则直接退出
    if (document.getElementById('bbb-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'bbb-fab';
    fab.innerHTML = `<span>☁️</span> 一键同步屏蔽词`;
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.id = 'bbb-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div id="bbb-panel">
        <div id="bbb-header">
          <div>
            <h2>☁️ 一键同步屏蔽词</h2>
            <p>自动点击所有屏蔽词右侧的云同步按钮</p>
          </div>
          <button id="bbb-close">✕</button>
        </div>
        <div id="bbb-body">
          <div id="bbb-info">正在扫描页面…</div>
          <div class="bbb-row">
            <label>点击间隔</label>
            <input type="range" id="bbb-speed" min="200" max="2000" step="100" value="500">
            <span id="bbb-speed-val">500 ms</span>
          </div>
          <div id="bbb-progress">
            <div id="bbb-bar-track"><div id="bbb-bar-fill"></div></div>
            <div id="bbb-bar-text">0 / 0</div>
          </div>
          <div id="bbb-log"></div>
          <div class="bbb-actions">
            <button id="bbb-start" disabled>🚀 开始同步</button>
            <button id="bbb-rescan">🔍 重新扫描</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const info     = overlay.querySelector('#bbb-info');
    const startBtn = overlay.querySelector('#bbb-start');
    const rescanBtn= overlay.querySelector('#bbb-rescan');
    const speedEl  = overlay.querySelector('#bbb-speed');
    const speedVal = overlay.querySelector('#bbb-speed-val');
    const progress = overlay.querySelector('#bbb-progress');
    const barFill  = overlay.querySelector('#bbb-bar-fill');
    const barText  = overlay.querySelector('#bbb-bar-text');
    const logBox   = overlay.querySelector('#bbb-log');

    let buttons = [];
    let running = false;

    speedEl.addEventListener('input', () => {
      speedVal.textContent = speedEl.value + ' ms';
    });

    function scan() {
      buttons = scanButtons();
      if (buttons.length === 0) {
        info.innerHTML = `⚠️ 未找到同步按钮。<br><small style="color:#999">请先展开左侧屏蔽词列表，再点「重新扫描」</small>`;
        startBtn.disabled = true;
      } else {
        info.innerHTML = `扫描到 <strong>${buttons.length}</strong> 个待同步按钮，准备就绪！`;
        startBtn.disabled = false;
      }
    }

    function log(cls, msg) {
      logBox.style.display = 'block';
      const line = document.createElement('div');
      line.className = cls;
      line.textContent = msg;
      logBox.appendChild(line);
      logBox.scrollTop = logBox.scrollHeight;
    }

    startBtn.addEventListener('click', async () => {
      if (running || buttons.length === 0) return;
      running = true;
      startBtn.disabled = true;
      rescanBtn.disabled = true;
      logBox.innerHTML = '';
      logBox.style.display = 'block';
      progress.style.display = 'block';

      const total = buttons.length;
      const delay = parseInt(speedEl.value, 10);
      let ok = 0, fail = 0;

      for (let i = 0; i < total; i++) {
        barFill.style.width = `${((i + 1) / total) * 100}%`;
        barText.textContent = `${i + 1} / ${total}`;
        try {
          buttons[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
          await sleep(80);
          buttons[i].click();
          ok++;
          log('ok', `✓ 第 ${i + 1} 条已同步`);
        } catch (e) {
          fail++;
          log('err', `✗ 第 ${i + 1} 条失败：${e.message}`);
        }
        if (i < total - 1) await sleep(delay);
      }

      barFill.style.width = '100%';
      barText.textContent = `✅ 完成！成功 ${ok} 条，失败 ${fail} 条`;
      log('info', '─────────────────────────────');
      log('ok', `🎉 全部完成：成功 ${ok} / ${total}`);

      // [修复1] 完成后禁用开始按钮，强制重新扫描才能再次触发，防止重复点击旧按钮
      startBtn.textContent = `✅ 完成 (${ok}/${total})`;
      startBtn.disabled = true;
      rescanBtn.disabled = false;
      buttons = [];
      running = false;
    });

    rescanBtn.addEventListener('click', () => {
      if (running) return;
      logBox.innerHTML = '';
      logBox.style.display = 'none';
      progress.style.display = 'none';
      barFill.style.width = '0%';
      startBtn.textContent = '🚀 开始同步';
      scan();
    });

    // [修复3] 运行中关闭时给出提示，而非静默无响应
    function tryClose() {
      if (running) {
        alert('同步进行中，请等待完成后再关闭');
        return;
      }
      overlay.style.display = 'none';
    }

    overlay.querySelector('#bbb-close').addEventListener('click', tryClose);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) tryClose();
    });

    fab.addEventListener('click', () => {
      overlay.style.display = 'flex';
      scan();
    });
  }

  // [Gemini修复1] 单页应用适配：用 MutationObserver 监听 URL 变化
  // B站切换视频时不会整页刷新，需要主动检测 URL 变动并重新注入 UI
  let lastUrl = location.href;
  const spaObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // 等待新页面渲染完成后再尝试注入（防重复注入由 buildUI 内部保护）
      setTimeout(buildUI, 1500);
    }
  });
  spaObserver.observe(document.body, { childList: true, subtree: true });

  // 初始注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

})();
