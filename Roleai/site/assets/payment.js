const API = window.ROLEAI_API_BASE || 'https://api.roleai.studio';
const api = path => fetch(API + path, {credentials: 'include', headers: {Accept: 'application/json'}});
const query = new URLSearchParams(location.search);
const currentOrderNo = query.get('order') || '';
const stateNames = ['已创建', '待支付', '支付成功', '支付失败', '已撤销', '已退款', '已关闭'];
const planNames = {subscription_monthly: '月度订阅', subscription_yearly: '年度订阅', lifetime_early_bird: '公测早鸟终身授权', lifetime: '终身授权', agent_credit: 'Agent 官方模型额度'};
const wayNames = {ALI_QR: '支付宝扫码', WX_LITE_H5: '微信支付'};
let pollTimer = 0;

function showOrderSkeleton(list) {
    list.setAttribute('aria-busy', 'true');
    list.replaceChildren(...Array.from({length: 3}, () => {
        const row = document.createElement('article'); row.className = 'order-row order-skeleton'; row.setAttribute('aria-hidden', 'true');
        ['skeleton-order-title','skeleton-order-meta','skeleton-order-state','skeleton-order-action'].forEach(className => { const block = document.createElement('span'); block.className = `skeleton-block ${className}`; row.append(block); });
        return row;
    }));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('zh-CN', {style: 'currency', currency: 'CNY'}).format(Number(amount || 0) / 100);
}

function createQrCanvas(value) {
    if (typeof qrcode !== 'function') return null;
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    const quietZone = 4;
    const scale = Math.max(1, Math.floor(280 / (count + quietZone * 2)));
    const size = (count + quietZone * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.className = 'payment-qr';
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', '支付宝付款二维码');
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#000';
    for (let row = 0; row < count; row += 1) {
        for (let column = 0; column < count; column += 1) {
            if (code.isDark(row, column)) {
                context.fillRect((column + quietZone) * scale, (row + quietZone) * scale, scale, scale);
            }
        }
    }
    return canvas;
}

function createPaymentLink(order, text) {
    const link = document.createElement('a');
    link.className = 'button primary';
    link.href = order.payment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    return link;
}

function renderPayment(order) {
    const panel = document.querySelector('#current-order');
    panel.hidden = false;
    document.querySelector('#order-number').textContent = order.merchant_order_no;
    document.querySelector('#order-state').textContent = stateNames[order.state] || '未知状态';
    document.querySelector('#order-state').dataset.state = String(order.state);
    document.querySelector('#order-plan').textContent = order.plan_name || planNames[order.plan_id] || order.plan_id;
    document.querySelector('#order-way').textContent = wayNames[order.way_code] || order.way_code;
    document.querySelector('#order-amount').textContent = formatMoney(order.amount);
    const action = document.querySelector('#payment-action');
    action.replaceChildren();
    if ([0, 1].includes(order.state) && order.payment?.url) {
        if (order.payment.type === 'code_url') {
            const canvas = createQrCanvas(order.payment.url);
            const hint = document.createElement('span');
            hint.className = 'muted';
            hint.textContent = '请使用支付宝扫描二维码付款';
            const link = createPaymentLink(order, '无法扫码时打开支付宝');
            if (canvas) action.append(canvas, hint, link);
            else action.append(link);
        } else {
            action.append(createPaymentLink(order, order.way_code === 'WX_LITE_H5' ? '前往微信支付' : '打开支付页面'));
        }
    }
    const messages = {0: '订单已创建，正在等待支付参数。', 1: '请完成付款，本页会自动确认结果。', 2: '付款成功，授权已经发放。请在桌面端重新校验授权。', 3: '支付失败，可返回官网重新下单。', 4: '订单已撤销。', 5: '订单已退款，对应授权已撤销。', 6: '订单已关闭。'};
    document.querySelector('#payment-message').textContent = messages[order.state] || '订单状态未知，请联系支持。';
    clearTimeout(pollTimer);
    if ([0, 1].includes(order.state)) pollTimer = setTimeout(() => loadOrder(order.merchant_order_no), 3000);
}

function orderRow(order) {
    const row = document.createElement('article');
    row.className = 'order-row';
    const title = document.createElement('strong');
    title.textContent = order.plan_name || planNames[order.plan_id] || order.plan_id;
    const meta = document.createElement('span');
    meta.textContent = `${formatMoney(order.amount)} · ${wayNames[order.way_code] || order.way_code}`;
    const state = document.createElement('span');
    state.className = 'state-badge';
    state.dataset.state = String(order.state);
    state.textContent = stateNames[order.state] || '未知';
    const action = document.createElement('a');
    action.className = 'button secondary order-action';
    action.href = '/payment.html?order=' + encodeURIComponent(order.merchant_order_no);
    action.textContent = '查看详情';
    action.setAttribute('aria-label', `查看${title.textContent}订单详情`);
    row.append(title, meta, state, action);
    return row;
}

function loginUrl() {
    const next = currentOrderNo && /^[A-Z0-9]{16,30}$/.test(currentOrderNo)
        ? '/payment.html?order=' + encodeURIComponent(currentOrderNo)
        : '/payment.html';
    return '/login.html?next=' + encodeURIComponent(next);
}

async function loadOrders() {
    const list = document.querySelector('#order-list');
    showOrderSkeleton(list);
    try {
        const response = await api('/v1/payments/orders');
        const body = await response.json();
        if (response.status === 401) { location.href = loginUrl(); return; }
        if (!response.ok) throw Error(body.error?.message || '无法加载订单');
        const orders = body.data?.items || [];
        list.removeAttribute('aria-busy'); list.replaceChildren(...(orders.length ? orders.map(orderRow) : [Object.assign(document.createElement('p'), {className: 'muted', textContent: '暂无订单'})]));
    } catch (error) {
        list.removeAttribute('aria-busy'); list.textContent = error.message || '无法加载订单';
    }
}

async function loadOrder(orderNo) {
    try {
        const response = await api('/v1/payments/orders/' + encodeURIComponent(orderNo));
        const body = await response.json();
        if (response.status === 401) { location.href = loginUrl(); return; }
        if (!response.ok) throw Error(body.error?.message || '无法读取订单');
        renderPayment(body.data.order);
        loadOrders();
    } catch (error) {
        document.querySelector('#current-order').hidden = false;
        document.querySelector('#payment-message').textContent = error.message || '无法读取订单';
    }
}

document.querySelector('#refresh-orders').onclick = loadOrders;
if (/^[A-Z0-9]{16,30}$/.test(currentOrderNo)) loadOrder(currentOrderNo);
else loadOrders();
