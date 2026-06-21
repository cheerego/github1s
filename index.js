// ==UserScript==
// @name         Open in github1s
// @name:zh-CN   在 github1s 中打开
// @namespace    https://github.com/conwnet/github1s
// @version      1.1.0
// @description  Add a button (and shortcut) on GitHub pages to open the current repo/file/branch in github1s.com — the VS Code style online reader.
// @description:zh-CN 在 GitHub 页面添加按钮和快捷键，一键在 github1s.com（VS Code 风格在线阅读器）中打开当前仓库 / 文件 / 分支，并保留当前路径。
// @author       you
// @match        https://github.com/*
// @icon         https://github1s.com/favicon.svg
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const GITHUB1S_HOST = 'github1s.com';
  const BUTTON_ID = 'open-in-github1s-btn';

  // 不需要注入按钮的路径（设置、通知、个人页等）
  const IGNORED_PREFIXES = [
    'settings', 'notifications', 'marketplace', 'explore', 'topics',
    'sponsors', 'pulls', 'issues', 'codespaces', 'new', 'organizations',
    'account', 'apps', 'about', 'pricing', 'features', 'login', 'join',
    'search', 'dashboard',
  ];

  /** 当前是否在一个仓库页面 */
  function isRepoPage() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    if (IGNORED_PREFIXES.includes(parts[0].toLowerCase())) return false;
    return true;
  }

  /** 把当前 github.com 的 URL 转换为 github1s.com 的 URL，保留路径 */
  function buildGithub1sUrl() {
    const url = new URL(location.href);
    url.hostname = GITHUB1S_HOST;
    url.port = '';
    return url.toString();
  }

  function openGithub1s() {
    if (!isRepoPage()) {
      // 不在仓库页面时，跳转到 github1s 首页
      window.open(`https://${GITHUB1S_HOST}/`, '_blank', 'noopener');
      return;
    }
    window.open(buildGithub1sUrl(), '_blank', 'noopener');
  }

  /** 当前应当指向的 github1s 链接（仓库页 -> 对应路径，否则 -> 首页） */
  function currentTargetUrl() {
    return isRepoPage() ? buildGithub1sUrl() : `https://${GITHUB1S_HOST}/`;
  }

  /** 创建按钮元素 */
  function createButton() {
    const btn = document.createElement('a');
    btn.id = BUTTON_ID;
    btn.href = currentTargetUrl();
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.title = '在 github1s 中打开（快捷键: g 然后 1）';
    btn.textContent = 'github1s';

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '5px 12px',
      marginLeft: '8px',
      fontSize: '12px',
      fontWeight: '600',
      lineHeight: '20px',
      color: '#fff',
      background: 'linear-gradient(90deg, #1f6feb, #388bfd)',
      border: '1px solid rgba(240,246,252,0.1)',
      borderRadius: '6px',
      cursor: 'pointer',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
    });

    // 在任何打开动作前实时刷新 href，确保 SPA 导航后链接（含中键/Cmd+点击）始终最新
    const refreshHref = () => {
      btn.href = currentTargetUrl();
    };
    btn.addEventListener('mouseenter', () => {
      refreshHref();
      btn.style.filter = 'brightness(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.filter = 'none';
    });
    // 中键 / 修饰键点击走浏览器默认行为（用最新 href 打开新标签）
    btn.addEventListener('mousedown', refreshHref);

    // 普通左键点击：阻止默认，手动打开最新地址
    btn.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openGithub1s();
    });

    return btn;
  }

  /** 把按钮注入到页面合适的位置（仅仓库页） */
  function injectButton() {
    if (!isRepoPage()) return;
    if (document.getElementById(BUTTON_ID)) return;

    // 优先放在仓库页面顶部的操作区
    const anchors = [
      'ul.pagehead-actions',                  // 旧版仓库头部操作区
      '.AppHeader-actions',                   // 新版顶部
      '[data-testid="repository-container-header"]',
    ];

    let target = null;
    for (const sel of anchors) {
      const el = document.querySelector(sel);
      if (el) {
        target = el;
        break;
      }
    }
    if (!target) return;

    const btn = createButton();

    if (target.tagName === 'UL') {
      const li = document.createElement('li');
      li.appendChild(btn);
      target.insertBefore(li, target.firstChild);
    } else {
      target.appendChild(btn);
    }
  }

  /** 快捷键：按 g 然后 1 打开 github1s */
  function setupShortcut() {
    let lastKey = '';
    let lastTime = 0;

    document.addEventListener('keydown', (e) => {
      // 在输入框 / 可编辑区域中不触发
      const el = e.target;
      const tag = (el && el.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (el && el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const key = e.key.toLowerCase();

      if (lastKey === 'g' && key === '1' && now - lastTime < 800) {
        e.preventDefault();
        openGithub1s();
        lastKey = '';
        return;
      }

      lastKey = key;
      lastTime = now;
    });
  }

  // GitHub 使用 PJAX/Turbo 进行无刷新导航，需要监听 URL 变化重新注入
  function observeNavigation() {
    let lastPath = location.pathname;

    const removeButton = () => {
      const existing = document.getElementById(BUTTON_ID);
      if (!existing) return;
      // 若按钮被包在 li 中，连同 li 一起移除，否则移除自身
      const li = existing.closest('li');
      if (li) {
        li.remove();
      } else {
        existing.remove();
      }
    };

    const reinject = () => {
      removeButton();
      injectButton();
    };

    // GitHub 的 Turbo 导航事件
    document.addEventListener('turbo:load', reinject);
    document.addEventListener('pjax:end', reinject);

    // 兜底：DOM 变化时检测路径与按钮存在性（用 rAF 合并高频变更）
    let scheduled = false;
    const handleMutations = () => {
      scheduled = false;
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        reinject();
      } else if (isRepoPage() && !document.getElementById(BUTTON_ID)) {
        injectButton();
      }
    };

    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(handleMutations);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    injectButton();
    setupShortcut();
    observeNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
