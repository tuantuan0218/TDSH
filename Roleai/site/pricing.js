(() => {
  'use strict';

  const endpoint = `${window.ROLEAI_API_BASE || 'https://api.roleai.studio'}/v1/product`;
  const $ = selector => document.querySelector(selector);
  const options = $('#plan-options');
  const buy = $('#purchase-submit');
  const message = $('#purchase-message');
  const periods = {month: '/ 月', year: '/ 年', lifetime: '一次购买'};
  const order = ['subscription_monthly', 'subscription_yearly', 'lifetime_early_bird', 'lifetime'];
  let selected = null;
  let paymentMethod = 'ALI_QR';

  const money = amount => `¥${(Number(amount || 0) / 100).toLocaleString('zh-CN')}`;

  function select(plan) {
    selected = plan;
    options.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.plan === plan.id));
    });
    $('#selected-badge').textContent = plan.badge || '';
    $('#selected-name').textContent = plan.name;
    $('#selected-summary').textContent = plan.summary || '完整使用 RoleAI Studio 创作能力。';
    $('#selected-price').textContent = money(plan.amount);
    $('#selected-period').textContent = periods[plan.billing_period] || '';
    $('#selected-term').textContent = plan.billing_period === 'lifetime'
      ? '永久使用 · 持续获得桌面版本更新'
      : '授权有效期内使用完整能力并获得版本更新';
    buy.textContent = `选择${plan.name} ↗`;
    buy.dataset.buy = plan.id;
    buy.dataset.way = paymentMethod;
    buy.disabled = false;
    message.textContent = '登录后可创建安全支付订单；模型用量单独结算。';

    const benefits = $('#paid-benefits');
    benefits.replaceChildren(...(plan.benefits || []).map(benefit => {
      const item = document.createElement('li');
      item.textContent = benefit;
      return item;
    }));
  }

  document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => {
    paymentMethod = button.dataset.method;
    document.querySelectorAll('[data-method]').forEach(item => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    if (selected) buy.dataset.way = paymentMethod;
  }));

  async function load() {
    options.setAttribute('aria-busy', 'true');
    buy.disabled = true;
    message.textContent = '正在加载官方授权方案…';
    try {
      const response = await fetch(endpoint, {credentials: 'include', headers: {Accept: 'application/json'}});
      const body = await response.json();
      if (!response.ok) throw Error(body.error?.message || '授权方案加载失败');
      const plans = (body.data?.license_plans || []).filter(plan => plan.purchasable !== false);
      plans.sort((a, b) => {
        const aIndex = order.indexOf(a.id);
        const bIndex = order.indexOf(b.id);
        return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
      });
      if (!plans.length) throw Error('当前暂无可购买的授权方案');
      options.replaceChildren(...plans.map(plan => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.plan = plan.id;
        const label = document.createElement('span');
        label.textContent = plan.name;
        const amount = document.createElement('small');
        amount.textContent = `${money(plan.amount)} ${periods[plan.billing_period] || ''}`;
        button.append(label, amount);
        button.addEventListener('click', () => select(plan));
        return button;
      }));
      select(plans.find(plan => plan.early_bird) || plans[0]);
    } catch (error) {
      options.replaceChildren();
      const unavailable = document.createElement('p');
      unavailable.className = 'muted';
      unavailable.textContent = '授权方案暂时无法加载，请稍后重试。';
      options.append(unavailable);
      buy.disabled = true;
      message.textContent = error.message || '授权方案加载失败';
    } finally {
      options.removeAttribute('aria-busy');
    }
  }

  load();
})();
