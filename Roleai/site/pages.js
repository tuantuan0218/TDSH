(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || 'index.html';
  const nested = location.pathname.includes('/legal/');
  const root = nested ? '../' : './';
  const homepage = page === 'index.html' || page === '';
  const accountPages = new Set(['login.html', 'payment.html', 'support.html', 'client-auth.html', 'identity.html', 'agent.html']);
  const currentKey = accountPages.has(page) ? 'account' : page;
  const primaryHeaderItems = [
    ['index.html', '首页', 'index.html'],
    ['index.html#mcp', 'MCP 编曲', 'mcp'],
    ['skill.html', '编曲 Skill', 'skill.html'],
    ['index.html#voice', 'AI 配音', 'voice'],
    ['index.html#instruments', '官方插件', 'instruments'],
    ['updates.html', '更新日志', 'updates.html'],
    ['downloads.html', '下载', 'downloads.html'],
    ['pricing.html', '订阅与授权', 'pricing.html']
  ];

  const itemMarkup = ([path, label, key]) => {
    const current = currentKey === key ? ' aria-current="page"' : '';
    return `<a href="${root}${path}"${current}>${label}</a>`;
  };
  const supportMarkup = `<a href="${root}support.html" data-account-support hidden>支持工单</a>`;
  const accountCurrent = currentKey === 'account' ? ' aria-current="page"' : '';
  const desktopAccountMarkup = `<a id="login-button" href="${root}login.html"${accountCurrent}>账户</a>`;
  const mobileAccountMarkup = `<a href="${root}login.html"${accountCurrent}>账户</a>`;
  const linkMarkup = primaryHeaderItems.map(itemMarkup).join('') + supportMarkup + desktopAccountMarkup;
  const mobileLinkMarkup = primaryHeaderItems.map(itemMarkup).join('') + supportMarkup + mobileAccountMarkup;

  document.body.classList.toggle('common-header-overlay', homepage);

  const currentHeader = document.querySelector('body > header.header, body > header.top');
  if (currentHeader) {
    const header = document.createElement('header');
    header.className = 'common-site-header';
    header.innerHTML = `<div class="common-site-header__inner">
      <a class="common-site-header__brand" href="${root}index.html" aria-label="RoleAI Studio 首页">
        <img src="${root}assets/roleai-icon.png" width="30" height="30" alt="">
        <span>RoleAI <b>Studio</b></span>
      </a>
      <nav class="common-site-header__nav" aria-label="主导航">${linkMarkup}</nav>
      <details class="common-site-header__menu">
        <summary>菜单 <span aria-hidden="true">＋</span></summary>
        <nav aria-label="移动端主导航">${mobileLinkMarkup}</nav>
      </details>
    </div>`;
    currentHeader.replaceWith(header);
    const menu = header.querySelector('.common-site-header__menu');
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }

  const quickTools = document.createElement('aside');
  quickTools.className = 'quick-tools';
  quickTools.setAttribute('aria-label', '快捷服务');
  quickTools.innerHTML = `<div class="quick-tools-panel">
    <div class="quick-tools-actions" aria-label="快捷操作">
      <button type="button" data-quick-action="top" aria-label="返回页面顶部" title="返回顶部">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>
      </button>
      <button type="button" data-quick-action="service" aria-label="打开微信客服二维码" aria-expanded="false" aria-controls="quick-tools-qr" title="微信客服">
        <svg class="wechat-mark" viewBox="0 0 24 24" aria-hidden="true"><path class="wechat-fill" d="M9.4 3.2C4.76 3.2 1 6.15 1 9.8c0 2.05 1.2 3.9 3.08 5.1l-.76 2.38 2.72-1.3c1.03.34 2.16.52 3.36.52.42 0 .84-.02 1.24-.07a5.8 5.8 0 0 1-.42-2.16c0-3.58 3.38-6.55 7.79-6.83C16.75 4.96 13.38 3.2 9.4 3.2Z"/><path class="wechat-fill" d="M15.92 8.7c-3.9 0-7.08 2.48-7.08 5.56s3.18 5.57 7.08 5.57c1.02 0 1.99-.18 2.86-.5l2.28 1.08-.64-2.02C22 17.37 23 15.89 23 14.26c0-3.08-3.17-5.57-7.08-5.57Z"/><circle class="wechat-eye" cx="6.43" cy="8.45" r=".78"/><circle class="wechat-eye" cx="11.35" cy="8.45" r=".78"/><circle class="wechat-eye" cx="13.53" cy="13.55" r=".68"/><circle class="wechat-eye" cx="17.76" cy="13.55" r=".68"/></svg>
      </button>
      <a href="${root}support.html" aria-label="提交或查看工单" title="帮助与工单">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h8l4 4v13h-12v-17Z"/><path d="M14.5 3.5v4h4M9.5 12h6M9.5 16h4.5"/></svg>
      </a>
    </div>
    <div class="quick-tools-qr" id="quick-tools-qr" hidden>
      <img src="${root}assets/wechat-customer-service.jpg" width="1065" height="1065" alt="RoleAI Studio 微信客服二维码">
      <p><strong>微信客服</strong><span>扫码添加客服，获取产品与售后支持</span></p>
    </div>
  </div>`;
  document.body.append(quickTools);

  const serviceButton = quickTools.querySelector('[data-quick-action="service"]');
  const qrPanel = quickTools.querySelector('.quick-tools-qr');
  const closeService = ({restoreFocus = false} = {}) => {
    qrPanel.hidden = true;
    serviceButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) serviceButton.focus();
  };
  quickTools.querySelector('[data-quick-action="top"]').addEventListener('click', () => {
    closeService();
    scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  });
  serviceButton.addEventListener('click', () => {
    const open = qrPanel.hidden;
    qrPanel.hidden = !open;
    serviceButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', event => {
    if (!qrPanel.hidden && !quickTools.contains(event.target)) closeService();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !qrPanel.hidden) closeService({restoreFocus: true});
  });

  const footer = document.querySelector('.common-site-footer');
  let quickLiftFrame = 0;
  const positionQuickTools = () => {
    quickLiftFrame = 0;
    const footerTop = footer?.getBoundingClientRect().top ?? innerHeight;
    quickTools.style.setProperty('--quick-tools-lift', `${Math.max(0, Math.ceil(innerHeight - footerTop))}px`);
  };
  const scheduleQuickToolsPosition = () => {
    if (!quickLiftFrame) quickLiftFrame = requestAnimationFrame(positionQuickTools);
  };
  addEventListener('scroll', scheduleQuickToolsPosition, {passive: true});
  addEventListener('resize', scheduleQuickToolsPosition, {passive: true});
  positionQuickTools();

  document.querySelectorAll('form').forEach(form => {
    [...form.elements].forEach(field => {
      if (!(field instanceof HTMLElement) || !field.getAttribute) return;
      const error = (field.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .map(id => document.getElementById(id))
        .find(node => node?.classList.contains('field-error'));
      if (!error) return;
      const update = () => {
        if (field.checkValidity()) {
          field.removeAttribute('aria-invalid');
          error.hidden = true;
          error.textContent = '';
          return;
        }
        field.setAttribute('aria-invalid', 'true');
        error.hidden = false;
        error.textContent = field.validity.valueMissing ? (field.dataset.errorRequired || '请填写此项')
          : field.validity.typeMismatch ? (field.dataset.errorType || '填写格式不正确')
          : field.validity.patternMismatch ? (field.dataset.errorPattern || '填写格式不正确')
          : field.validity.tooShort ? (field.dataset.errorTooShort || '填写内容过短')
          : field.dataset.errorInvalid || '请检查填写内容';
      };
      field.addEventListener('blur', update);
      field.addEventListener(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (field.getAttribute('aria-invalid') === 'true') update();
      });
    });
  });

  document.querySelectorAll('.page-hero,.auth-context,.auth-panel,.support-heading,.section-heading')
    .forEach(element => element.classList.add('page-enter'));

  if (homepage) return;
  const canvas = document.querySelector('.page-atmosphere');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let last = 0;
  let time = 0;
  let width = 0;
  let height = 0;
  const draw = () => {
    context.clearRect(0, 0, width, height);
    const quiet = /login|identity|client-auth|payment|agent/.test(page) || nested;
    const alpha = quiet ? .045 : .12;
    for (let line = 0; line < 7; line += 1) {
      context.beginPath();
      context.strokeStyle = `rgba(190,214,218,${alpha * .65})`;
      context.lineWidth = .8;
      for (let step = 0; step <= 75; step += 1) {
        const x = step / 75 * width;
        const y = height * .36 + Math.sin(step / 75 * 5 + time * .15 + line * .075) * height * .23 + line * 12;
        if (!step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
  };
  const schedule = () => {
    if (!frame && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
  };
  const tick = now => {
    frame = 0;
    if (document.hidden || reducedMotion.matches) return;
    if (now - last < 45) { schedule(); return; }
    const delta = Math.min(70, now - (last || now));
    last = now;
    time += delta / 1000;
    draw();
    schedule();
  };
  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.25);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
    schedule();
  };
  reducedMotion.addEventListener('change', () => { last = 0; draw(); schedule(); });
  document.addEventListener('visibilitychange', () => { last = 0; schedule(); });
  addEventListener('resize', resize, {passive: true});
  resize();
})();
