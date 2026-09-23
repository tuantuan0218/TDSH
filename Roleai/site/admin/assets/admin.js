const API = 'https://api.roleai.studio';
let token = sessionStorage.getItem('roleai_admin_token') || '';
if (!token) location.replace('/admin/login.html');
const titles = {overview: '服务概览', orders: '支付订单', benefits: '人工权益', support: '支持工单', plans: '授权方案', users: '用户与设备', identities: '实名认证', 'regulatory-cases': '监管协查', licenses: '用户授权', releases: '版本与更新包', resources: '插件与模型资源', documents: '协议与政策', watermarks: '音频水印', audit: '操作审计'};
const labels = {id: 'ID', phone: '手机号', status: '状态', created_at: '创建时间', updated_at: '更新时间', merchant_order_no: '订单号', plan_code: '订单方案', amount_fen: '金额', state: '支付状态', paid_at: '支付时间', user_id: '用户 ID', type: '授权类型', expires_at: '到期时间', entitlement: '当前订阅', devices: '设备', version: '版本', channel: '通道', platform: '平台', published_at: '发布时间', full_package_size: '安装包字节数', slug: '标识', name: '名称', actor_id: '操作者', action: '操作', target_type: '目标类型', target_id: '目标 ID'};
const columns = {users: ['id','phone','status','entitlement','devices','created_at'], orders: ['id','merchant_order_no','user_id','phone','plan_code','entitlement','amount_fen','state','paid_at'], licenses: ['id','user_id','phone','type','status','entitlement','expires_at'], releases: ['id','version','channel','platform','full_package_size','status','published_at'], resources: ['id','slug','name','type','platform','version','status'], audit: ['id','actor_id','action','target_type','target_id','created_at']};
const auditActionLabels = {
    admin_logout: '管理员退出登录',
    admin_mfa_setup_started: '开始设置管理员双因素认证',
    admin_mfa_enabled: '启用管理员双因素认证',
    admin_step_up_succeeded: '管理员二次认证成功',
    admin_recovery_codes_regenerated: '重新生成管理员恢复码',
    admin_mfa_reset_by_owner: '所有者重置管理员双因素认证',
    security_event_acknowledged: '确认安全事件',
    payment_order_created: '创建支付订单',
    payment_state_changed: '变更支付状态',
    license_issued: '签发软件授权',
    license_revoked_after_refund: '退款后撤销软件授权',
    license_plan_updated: '更新授权方案',
    early_bird_plan_closed: '结束早鸟授权方案',
    user_status_changed: '变更用户状态',
    license_status_changed: '变更授权状态',
    admin_releases_created: '创建软件版本',
    admin_release_created: '创建软件版本',
    release_draft_updated: '更新软件版本草稿',
    published_release_metadata_updated: '更新已发布版本的运营信息',
    release_status_changed: '变更软件版本状态',
    admin_resources_created: '创建插件或模型资源',
    admin_resource_created: '创建插件或模型资源',
    resource_draft_updated: '更新资源草稿',
    published_resource_metadata_updated: '修正已发布资源名称',
    resource_status_changed: '变更资源状态',
    compliance_document_draft_created: '创建协议或政策草稿',
    compliance_document_draft_updated: '更新协议或政策草稿',
    compliance_document_published: '发布协议或政策版本',
    identity_verification_records_searched: '查询实名认证记录',
    watermark_records_searched: '查询音频水印记录',
    watermark_record_viewed: '查看音频水印记录',
    watermark_acoustic_token_verified: '验证 RAT2 声学查询令牌',
    regulatory_case_listed: '查看监管协查案件列表',
    regulatory_case_created: '创建监管协查案件',
    regulatory_case_viewed: '查看监管协查案件',
    regulatory_case_document_uploaded: '上传监管协查文书',
    regulatory_case_document_downloaded: '下载监管协查文书',
    regulatory_case_approved: '审批监管协查案件',
    regulatory_case_export_created: '生成监管协查证据包',
    regulatory_case_export_downloaded: '下载监管协查证据包'
};
const auditTargetLabels = {
    admin_user: '管理员账号', security_event: '安全事件', payment_order: '支付订单',
    license_plan: '授权方案', user: '用户账号', license: '软件授权', release: '软件版本',
    resource: '插件或模型资源', compliance_document: '协议或政策', identity_verification: '实名认证记录',
    audio_watermark: '音频水印', regulatory_case: '监管协查案件'
};
const editor = document.querySelector('#editor-dialog');
const editorForm = document.querySelector('#editor-form');
const editorFields = document.querySelector('#editor-fields');
const editorMessage = document.querySelector('#editor-message');
const confirmDialog = document.querySelector('#confirm-dialog');
const watermarkDetailDialog = document.querySelector('#watermark-detail-dialog');
const regulatoryCaseDialog = document.querySelector('#regulatory-case-dialog');
const stepUpDialog = document.querySelector('#step-up-dialog');
let editorState = null;
let confirmAction = null;
let pendingStepUp = null;
let stepUpExpiresAt = 0;

async function parseJsonResponse(response, fallbackMessage = '请求失败') {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (_) {
        const requestId = response.headers.get('x-request-id');
        const detail = requestId ? `，请求 ID：${requestId}` : '';
        if (response.status === 413) throw Error(`文件超过服务器允许的上传大小${detail}`);
        throw Error(`${fallbackMessage}：服务器返回了异常响应${detail}`);
    }
}

async function request(path, options = {}, allowStepUp = true) {
    const upload = options.body instanceof FormData;
    const response = await fetch(API + path, {credentials: 'omit', ...options, headers: {Accept: 'application/json', ...(!upload ? {'Content-Type': 'application/json'} : {}), Authorization: `Bearer ${token}`, ...options.headers}});
    const body = await parseJsonResponse(response);
    if (response.status === 428 && body.error?.code === 'admin_step_up_required' && allowStepUp && path !== '/v1/admin/security/step-up') {
        return requireInlineStepUp(() => request(path, options, false));
    }
    if (response.status === 401 && body.error?.code === 'admin_unauthorized') { sessionStorage.removeItem('roleai_admin_token'); location.replace('/admin/login.html'); throw Error('登录已过期'); }
    if (!response.ok) throw Error(body.error?.message || '请求失败');
    return body.data;
}

// Separate operations surface: model prices do not change software-license plans.
const agentNavigation = document.createElement('a');
agentNavigation.className = 'sidebar-link';
agentNavigation.href = '/admin/agent.html';
agentNavigation.textContent = 'Agent 模型与计费';
document.querySelector('.sidebar nav')?.append(agentNavigation);

function requireInlineStepUp(retry) {
    if (pendingStepUp) return Promise.reject(Error('请先完成当前二次认证'));
    return new Promise((resolve, reject) => {
        pendingStepUp = {retry, resolve, reject};
        document.querySelector('#step-up-form').reset();
        document.querySelector('#step-up-message').textContent = '';
        document.querySelector('#step-up-security-link').hidden = true;
        stepUpDialog.showModal();
        document.querySelector('#inline-step-up-password').focus();
    });
}

function cancelInlineStepUp() {
    if (pendingStepUp) pendingStepUp.reject(Error('操作已取消'));
    pendingStepUp = null;
    stepUpDialog.close();
}

document.querySelectorAll('[data-close-step-up]').forEach(button => button.onclick = cancelInlineStepUp);
stepUpDialog.addEventListener('cancel', event => { event.preventDefault(); cancelInlineStepUp(); });
document.querySelector('#step-up-form').onsubmit = async event => {
    event.preventDefault();
    const submit = document.querySelector('#step-up-submit');
    const message = document.querySelector('#step-up-message');
    submit.disabled = true; message.textContent = '正在验证…';
    try {
        const result = await request('/v1/admin/security/step-up', {method: 'POST', body: JSON.stringify({
            password: document.querySelector('#inline-step-up-password').value,
            code: document.querySelector('#inline-step-up-code').value,
        })}, false);
        stepUpExpiresAt = Date.now() + Number(result.expires_in || 600) * 1000;
        const pending = pendingStepUp; pendingStepUp = null; stepUpDialog.close(); updateStepUpLabel();
        try { pending.resolve(await pending.retry()); }
        catch (retryError) { pending.reject(retryError); }
    } catch (error) {
        message.textContent = error.message;
        document.querySelector('#step-up-security-link').hidden = !/启用双因素认证/.test(error.message);
    } finally { submit.disabled = false; }
};

function node(tag, className, text) {
    const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item;
}

const iconPaths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    plans: '<path d="M20 13 13 20a2 2 0 0 1-2.8 0L4 13.8A2 2 0 0 1 4 11l7-7h7l2 2v7Z"/><circle cx="15.5" cy="8.5" r="1"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 5.8M17 14c2.3.8 4 3.1 4 6"/>',
    identity: '<path d="M4 5h16v14H4z"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.6-1.6 1.4-2.5 2.5-2.5s1.9.9 2.5 2.5M14 9h3M14 13h3"/>',
    cases: '<path d="M9 4h6M9 2h6v4H9z"/><path d="M7 4H5v18h14V4h-2M8 11h8M8 15h8M8 19h5"/>',
    license: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/>',
    releases: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9"/>',
    resources: '<path d="M8.5 4 12 2l3.5 2L12 6 8.5 4ZM4 9l3.5-2L11 9l-3.5 2L4 9Zm9 0 3.5-2L20 9l-3.5 2L13 9Zm-4.5 5 3.5-2 3.5 2-3.5 2-3.5-2Z"/><path d="M7.5 11v4L12 18l4.5-3v-4M12 16v5"/>',
    documents: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
    orders: '<path d="M3 5h18v14H3z"/><path d="M3 10h18M7 15h3"/>',
    support: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
    watermark: '<path d="M4 8c3-4 5 4 8 0s5 4 8 0M4 13c3-4 5 4 8 0s5 4 8 0M4 18c3-4 5 4 8 0s5 4 8 0"/>',
    audit: '<path d="M9 5h6M9 3h6v4H9z"/><path d="M7 5H5v17h14V5h-2M8 12h8M8 16h5"/><path d="m14 19 1.5 1.5L19 17"/>',
    security: '<path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M6 12l3-3 3 3 3-5 3 3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>'
};
document.querySelectorAll('[data-icon]').forEach(slot => {
    const path = iconPaths[slot.dataset.icon];
    if (path) slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
});

function updateStepUpLabel() {
    const label = document.querySelector('#admin-role');
    if (!label) return;
    const remaining = Math.max(0, Math.ceil((stepUpExpiresAt - Date.now()) / 1000));
    if (remaining > 0) label.textContent = `二次认证：还剩 ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    else if (label.dataset.role) label.textContent = label.dataset.mfa === '0' ? `${label.dataset.role} · 未启用 MFA` : `${label.dataset.role} · 需要时验证`;
}
setInterval(updateStepUpLabel, 1000);

function displayValue(key, value) {
    if (key === 'amount_fen' && value !== null) return new Intl.NumberFormat('zh-CN', {style: 'currency', currency: 'CNY'}).format(Number(value) / 100);
    if (key === 'state') return ['已创建','待支付','支付成功','支付失败','已撤销','已退款','已关闭'][Number(value)] || value;
    if (key === 'status') return ({draft:'草稿',published:'已发布',archived:'已归档',active:'正常',disabled:'已禁用',pending:'待处理',expired:'已过期',revoked:'已撤销'}[value] || value);
    if (key === 'platform') return ({universal:'Windows 与 macOS 通用','windows-x64':'Windows x64','macos-universal2':'macOS Universal 2'}[value] || value);
    if (key === 'actor_id') return value === null || value === undefined ? '系统' : value;
    if (key === 'action') return auditActionLabels[value] || '其他系统操作';
    if (key === 'target_type') return value ? (auditTargetLabels[value] || '其他业务对象') : '—';
    return value ?? '—';
}

function entitlementLabel(item) {
    if (item.entitlement_type === 'lifetime' && item.entitlement_status === 'active') return '终身授权';
    if (item.entitlement_type === 'subscription' && item.entitlement_status === 'active') return `订阅有效至 ${String(item.entitlement_expires_at || '').slice(0, 10)}`;
    if (item.entitlement_type === 'subscription') return '订阅已到期';
    if (item.entitlement_status === 'revoked') return '授权已撤销';
    return '免费方案';
}
function entitlementClass(item) { if (item.entitlement_status === 'active') return 'active'; if (item.entitlement_status === 'revoked') return 'revoked'; return item.entitlement_type === 'free' ? 'free' : 'expired'; }

function actionButton(item, type) {
    if (!['users','licenses','resources','releases'].includes(type)) return null;
    const button = node('button', 'secondary');
    button.dataset.id = item.id;
    if (type === 'users') { button.dataset.action = 'user'; button.dataset.status = item.status === 'active' ? 'disabled' : 'active'; button.textContent = item.status === 'active' ? '禁用' : '启用'; }
    if (type === 'licenses') { button.dataset.action = 'license'; button.dataset.status = item.status === 'revoked' ? 'active' : 'revoked'; button.textContent = item.status === 'revoked' ? '恢复' : '撤销'; }
    if (type === 'resources') { button.dataset.action = 'resource'; button.dataset.status = item.status === 'published' ? 'archived' : 'published'; button.textContent = item.status === 'published' ? '归档' : '发布'; }
    if (type === 'releases') { button.dataset.action = 'release'; button.dataset.status = item.status === 'published' ? 'archived' : 'published'; button.textContent = item.status === 'published' ? '归档' : '发布'; }
    return button;
}

function renderTable(items, type) {
    if (!items.length) return node('p', 'muted', '暂无数据');
    const wrap = node('div', 'data-table'); const table = node('table'); const head = node('thead'); const headRow = node('tr');
    columns[type].forEach(key => headRow.append(node('th', '', labels[key] || key))); headRow.append(node('th', '', '操作')); head.append(headRow);
    const body = node('tbody');
    items.forEach(item => {
        const row = node('tr');
        columns[type].forEach(key => {
            const cell = node('td'); const value = displayValue(key, item[key]);
            if (key === 'status') cell.append(node('span', `status ${item[key]}`, value));
            else if (key === 'entitlement') cell.append(node('span', `status ${entitlementClass(item)}`, entitlementLabel(item)));
            else if (key === 'devices') { cell.append(node('strong','',`${item.device_count || 0} 台`)); if(item.device_names) cell.append(node('small','table-subtext',item.device_names)); if(item.device_last_seen_at) cell.append(node('small','table-subtext',`最近活跃：${formatDateTime(item.device_last_seen_at)}`)); }
            else cell.textContent = value;
            if (type === 'audit' && ['action','target_type'].includes(key) && item[key]) cell.title = item[key]; row.append(cell);
        });
        const actions = node('td'); const actionRow = node('div', 'row-actions');
        if (['releases','resources'].includes(type)) { const edit = node('button', 'secondary', '查看 / 编辑'); edit.dataset.editItem = type; edit._item = item; actionRow.append(edit); }
        const button = actionButton(item, type); if (button) actionRow.append(button);
        if (actionRow.childElementCount) actions.append(actionRow); else actions.textContent = '—'; row.append(actions); body.append(row);
    });
    table.append(head, body); wrap.append(table); return wrap;
}

async function loadList(type) {
    const panel = document.querySelector(`[data-list="${type}"]`); if (!panel) return;
    panel.replaceChildren(node('p', 'muted', '正在加载…'));
    try {
        const form = document.querySelector(`[data-filter-for="${type}"]`); const params = form ? new URLSearchParams(new FormData(form)) : new URLSearchParams();
        for (const [key,value] of [...params]) if (!String(value).trim()) params.delete(key);
        const data = await request(`/v1/admin/${type}${params.size ? `?${params}` : ''}`);
        const heading = node('div', 'panel-heading'); heading.append(node('h2', '', titles[type] || (type === 'orders' ? '支付订单' : type)));
        if (['releases','resources'].includes(type)) { const create = node('button', '', type === 'releases' ? '新建发布' : '新建资源'); create.dataset.create = type; heading.append(create); }
        const summary=document.querySelector(`[data-filter-summary="${type}"]`);if(summary)summary.textContent=`显示 ${Number(data.result_count ?? (data.items || []).length)} 条结果${Number(data.result_count||0)>=Number(data.limit||200)?`（最多显示 ${data.limit} 条，请增加筛选条件）`:''}`;
        panel.replaceChildren(heading, renderTable(data.items || [], type));
    } catch (error) { panel.replaceChildren(node('p', 'muted', error.message)); }
}

async function loadPlans() {
    const target = document.querySelector('#plan-admin-list'); target.replaceChildren(node('p', 'muted', '正在加载…'));
    try {
        const data = await request('/v1/admin/plans');
        target.replaceChildren(...(data.items || []).map(plan => {
            const card = node('article', 'plan-admin-card'); const head = node('header'); const title = node('div'); title.append(node('h3', '', plan.name), node('small', 'muted', plan.code)); head.append(title, node('span', `status ${Number(plan.active) ? 'active' : ''}`, Number(plan.active) ? '官网展示中' : '已停用')); card.append(head);
            card.append(node('div', 'price', Number(plan.purchasable)===1?new Intl.NumberFormat('zh-CN', {style: 'currency', currency: 'CNY'}).format(Number(plan.amount_fen) / 100):'免费 · 默认可用'), node('p', 'muted', plan.summary));
            const list = node('ul'); (plan.benefits || []).forEach(benefit => list.append(node('li', '', benefit))); card.append(list);
            if((plan.limitations||[]).length){const limits=node('ul','muted');plan.limitations.forEach(item=>limits.append(node('li','',item)));card.append(limits);}
            const edit = node('button', 'secondary', '编辑方案'); edit.dataset.editPlan = plan.id; edit._plan = plan; card.append(edit); return card;
        }));
    } catch (error) { target.replaceChildren(node('p', 'muted', error.message)); }
}

function renderTrend(data) {
    const chart = document.querySelector('#trend-chart'); chart.replaceChildren();
    const rows = (data.daily || []).slice(-14); if (!rows.length) return;
    const values = rows.flatMap(row => [Number(row.active || 0), Number(row.downloads || 0)]); const max = Math.max(1, ...values);
    const width = 760, height = 250, left = 45, right = 20, top = 20, bottom = 24, plotWidth = width - left - right, plotHeight = height - top - bottom;
    const point = (value, index) => [left + (rows.length === 1 ? 0 : index * plotWidth / (rows.length - 1)), top + plotHeight - Number(value || 0) / max * plotHeight];
    const pathFor = key => rows.map((row,index) => { const [x,y] = point(row[key],index); return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ');
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns,'svg'); svg.setAttribute('viewBox',`0 0 ${width} ${height}`); svg.setAttribute('role','img'); svg.setAttribute('aria-label','近十四天活跃用户与下载量趋势');
    const defs = document.createElementNS(ns,'defs'); const gradient = document.createElementNS(ns,'linearGradient'); gradient.id='trend-area'; gradient.setAttribute('x1','0'); gradient.setAttribute('y1','0'); gradient.setAttribute('x2','0'); gradient.setAttribute('y2','1'); [['0%','#3568df','.22'],['100%','#3568df','0']].forEach(([offset,color,opacity])=>{const stop=document.createElementNS(ns,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',color);stop.setAttribute('stop-opacity',opacity);gradient.append(stop);}); defs.append(gradient); svg.append(defs);
    for(let i=0;i<5;i++){const y=top+i*plotHeight/4;const line=document.createElementNS(ns,'line');line.setAttribute('x1',left);line.setAttribute('x2',width-right);line.setAttribute('y1',y);line.setAttribute('y2',y);line.setAttribute('stroke','#e8ecf2');svg.append(line);}
    const activePath=pathFor('active'); const area=document.createElementNS(ns,'path'); area.setAttribute('d',`${activePath} L${width-right} ${top+plotHeight} L${left} ${top+plotHeight} Z`); area.setAttribute('fill','url(#trend-area)'); svg.append(area);
    [['active','#3568df','3',''],['downloads','#45b9c4','2.5','6 5']].forEach(([key,color,strokeWidth,dash])=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',pathFor(key));path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width',strokeWidth);path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');if(dash)path.setAttribute('stroke-dasharray',dash);svg.append(path);});
    rows.forEach((row,index)=>{if(index%3!==0&&index!==rows.length-1)return;const [x]=point(0,index);const label=document.createElementNS(ns,'text');label.setAttribute('x',x);label.setAttribute('y',height-3);label.setAttribute('text-anchor',index===0?'start':index===rows.length-1?'end':'middle');label.textContent=index===rows.length-1?'今天':String(row.day||'').slice(5);svg.append(label);}); chart.append(svg);
}

async function loadOverview() {
    try {
        const data = await request('/v1/admin/stats');
        document.querySelector('#stat-users').textContent = Number(data.users || 0).toLocaleString(); document.querySelector('#stat-active').textContent = Number(data.active_24h || 0).toLocaleString(); document.querySelector('#stat-revenue-today').textContent = formatMoney(data.today_revenue_fen); document.querySelector('#stat-downloads').textContent = Number(data.downloads || 0).toLocaleString(); document.querySelector('#stats-message').textContent = '活跃用户按已登录账号去重；收入按今日支付成功时间统计'; renderTrend(data);
        const top = document.querySelector('#top-resources'); const items = data.top_resources || []; top.replaceChildren(...(items.length ? items.map(item => { const row = node('div', 'resource-row'); row.append(node('span', '', item.resource_slug || '未标记资源'), node('strong', '', `${item.downloads} 次`)); return row; }) : [node('p', 'muted', '暂无下载数据')]));
    } catch (error) { document.querySelector('#stats-message').textContent = error.message; }
}

const watermarkTypeLabels = {tts: 'TTS', voice_conversion: 'AI 变声', mix_export: '混音导出', stem_export: 'Stem 导出'};
const watermarkStatusLabels = {issued: '已签发', finalized: '已完成', abandoned: '已放弃'};
const identityStatusLabels = {verified: '已通过', rejected: '未通过'};
const identityResultLabels = {
    '101': '三要素一致',
    '201': '姓名、证件号均不一致',
    '202': '证件号不一致',
    '203': '姓名不一致',
    '204': '其他不一致',
    '301': '查无记录',
    unknown: '响应结果缺失'
};
const regulatoryCaseStatusLabels = {open: '待审批', approved: '已审批', exported: '已导出', closed: '已关闭'};

function formatDateTime(value) {
    if (!value) return '—';
    const text = String(value);
    // MySQL DATETIME values returned by the administration API are already
    // Asia/Shanghai wall-clock time. Appending "Z" treated them as UTC and
    // added another eight hours in Chinese browsers.
    const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? text : date.toLocaleString('zh-CN', {hour12: false});
}

const documentTypeLabels = {user_agreement: '用户协议', privacy_policy: '隐私政策'};

function documentStatusLabel(document) {
    if (Number(document.active) === 1) return ['published', '当前生效'];
    if (document.status === 'draft') return ['draft', '草稿'];
    return ['', '历史版本'];
}

function renderDocumentEditor(document = null) {
    const panel = node('section', 'panel document-editor');
    panel.append(node('p', 'eyebrow', 'DOCUMENT EDITOR'), node('h2', '', document ? `${documentTypeLabels[document.document_type]}${document.status === 'draft' ? '草稿' : ''}` : '新建协议或政策'));
    panel.append(node('p', '', document?.status === 'draft' ? '可编辑规范化 HTML；发布后生成不可变版本。' : document ? '已发布正文只读；修改内容请创建新版本。' : '可上传 DOCX 创建草稿，审核后发布。'));
    const form = node('form'); form.id = 'document-editor-form';
    const immutable = document && document.status !== 'draft';
    const type = selectField('document_type', '文档类型', [['user_agreement','用户协议'],['privacy_policy','隐私政策']], document?.document_type || 'user_agreement');
    const version = inputField('version', '版本号', 'text', {required:true, value:document?.version || ''});
    const title = inputField('title', '标题', 'text', {required:true, value:document?.title || ''});
    const htmlMode = Boolean(document?.content_html);
    const content = htmlMode ? node('label', 'legal-editor-field') : inputField('content_markdown', '正文', 'textarea', {required:true, value:document?.content_markdown || ''});
    if (htmlMode) {
        content.append(window.document.createTextNode('正文（可视化编辑）'));
        const toolbar=node('div','legal-editor-toolbar');
        [['formatBlock','H2','标题'],['bold',null,'加粗'],['insertUnorderedList',null,'项目符号'],['insertOrderedList',null,'编号列表']].forEach(([command,value,label])=>{const button=node('button','secondary',label);button.type='button';button.disabled=immutable;button.onclick=()=>{rich.focus();window.document.execCommand(command,false,value);hidden.value=rich.innerHTML;};toolbar.append(button);});
        const rich=node('div','legal-rich-editor');rich.contentEditable=immutable?'false':'true';rich.innerHTML=document.content_html;rich.setAttribute('role','textbox');rich.setAttribute('aria-multiline','true');
        const hidden=window.document.createElement('textarea');hidden.name='content_html';hidden.required=true;hidden.hidden=true;hidden.value=document.content_html;rich.oninput=()=>hidden.value=rich.innerHTML;
        content.append(toolbar,rich,hidden);
    }
    [type, version, title, content].forEach(field => { const control = field.querySelector('input,select,textarea'); if (immutable && control) control.disabled = true; form.append(field); });
    const actions = node('div', 'document-editor-actions');
    if (!immutable) {
        const save = node('button', 'secondary', document ? '保存草稿' : '创建草稿'); save.type = 'submit';
        actions.append(save);
        if (document) { const publish = node('button', '', '审核并发布'); publish.type = 'button'; publish.dataset.publishDocument = document.id; actions.append(publish); }
    }
    form.append(actions, node('p', 'status-message'));
    form.onsubmit = async event => {
        event.preventDefault(); const message = form.querySelector('.status-message'); message.textContent = '正在保存…';
        try {
            const rich=form.querySelector('.legal-rich-editor'),hidden=form.querySelector('textarea[name="content_html"]');if(rich&&hidden)hidden.value=rich.innerHTML;
            const values = Object.fromEntries(new FormData(form));
            await request(document ? `/v1/admin/compliance-documents/${document.id}` : '/v1/admin/compliance-documents', {method: document ? 'PUT' : 'POST', body: JSON.stringify(values)});
            await loadDocuments();
        } catch (error) { message.textContent = error.message; }
    };
    panel.append(form); return panel;
}

async function loadDocuments(selectedId = null) {
    const target = document.querySelector('#document-management');
    target.replaceChildren(node('div', 'panel', '正在加载…'));
    try {
        const data = await request('/v1/admin/compliance-documents'); const items = data.items || [];
        const selected = selectedId ? items.find(item => String(item.id) === String(selectedId)) : items.find(item => item.status === 'draft') || null;
        const listPanel = node('section', 'panel');
        const heading = node('div', 'panel-heading'); const headingText = node('div'); headingText.append(node('h2', '', '协议版本'), node('span', 'muted', '发布后正文不可修改，新内容通过新版本生效'));
        const upload = node('button', '', '上传 Word'); upload.type='button'; upload.onclick=showDocxImporter;
        const create = node('button', 'secondary', '新建文本草稿'); create.type = 'button'; create.onclick = () => target.replaceChildren(renderDocumentLayout(items, null)); const actions=node('div','row-actions');actions.append(create,upload);heading.append(headingText, actions); listPanel.append(heading);
        const list = node('div', 'document-list');
        items.forEach(item => {
            const row = node('div', 'document-row'); const info = node('div'); info.append(node('h3', '', `${documentTypeLabels[item.document_type]} · ${item.version}`), node('p', '', item.published_at ? `${item.published_at} 生效` : `最后更新于 ${item.updated_at || item.created_at || '—'}`));
            const [statusClass, statusText] = documentStatusLabel(item); const status = node('span', `status ${statusClass}`, statusText); const view = node('button', item.status === 'draft' ? '' : 'secondary', item.status === 'draft' ? '继续编辑' : '查看'); view.onclick = () => target.replaceChildren(renderDocumentLayout(items, item)); row.append(info, status, view); list.append(row);
        });
        if (!items.length) list.append(node('p', 'muted', '暂无协议版本，请先创建草稿。'));
        listPanel.append(list);
        const layout = node('div', 'document-layout'); layout.append(listPanel, renderDocumentEditor(selected)); target.replaceChildren(layout);
    } catch (error) { target.replaceChildren(node('div', 'panel', error.message)); }
}

function renderDocumentLayout(items, selected) {
    const holder = node('div', 'document-layout');
    const listPanel = node('section', 'panel'); const heading = node('div', 'panel-heading'); const text = node('div'); text.append(node('h2', '', '协议版本'), node('span', 'muted', '发布后正文不可修改，新内容通过新版本生效')); heading.append(text); listPanel.append(heading);
    const list = node('div', 'document-list'); items.forEach(item => { const row = node('div', 'document-row'); const info = node('div'); info.append(node('h3', '', `${documentTypeLabels[item.document_type]} · ${item.version}`), node('p', '', item.published_at || item.updated_at || '—')); const [c,t] = documentStatusLabel(item); const status = node('span', `status ${c}`, t); const open = node('button', 'secondary', '查看'); open.onclick = () => loadDocuments(item.id); row.append(info,status,open); list.append(row); }); listPanel.append(list); holder.append(listPanel, renderDocumentEditor(selected)); return holder;
}

function formatMoney(amountFen) {
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency', currency: 'CNY', minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(Number(amountFen || 0) / 100);
}

function showDocxImporter() {
    const target=document.querySelector('#document-management'); const panel=node('section','panel document-editor');
    panel.append(node('p','eyebrow','DOCX IMPORT'),node('h2','','上传 Word 法律文档'),node('p','muted','仅支持无宏 DOCX。系统会保留原件哈希，并转换为经过安全清洗的响应式网页正文。'));
    const form=node('form');form.enctype='multipart/form-data';form.innerHTML='<label>文档类型<select name="document_type"><option value="user_agreement">用户协议</option><option value="privacy_policy">隐私政策</option></select></label><label>版本号<input name="version" required maxlength="32" pattern="[A-Za-z0-9._-]+"></label><label>标题<input name="title" required maxlength="160"></label><label>DOCX 文件<input name="document" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required></label><div class="document-editor-actions"><button type="button" class="secondary">取消</button><button type="submit">上传并转换</button></div><p class="status-message"></p>';
    form.querySelector('button[type="button"]').onclick=()=>loadDocuments();
    form.onsubmit=async event=>{event.preventDefault();const message=form.querySelector('.status-message');message.textContent='正在安全转换 Word 文档…';try{await request('/v1/admin/compliance-documents/import-docx',{method:'POST',body:new FormData(form)});await loadDocuments();}catch(error){message.textContent=error.message;}};
    panel.append(form);target.replaceChildren(panel);
}

function commerceMetric(label,value){const item=node('article','metric');item.append(node('small','',label),node('strong','',value));return item;}
async function loadCommerceStats(){
    const dashboard=document.querySelector('#commerce-dashboard');
    try{const stats=await request('/v1/admin/commerce/stats?days=30');const s=stats.summary||{};const grid=node('div','metric-grid commerce-metrics');grid.append(commerceMetric('近 30 天实收',formatMoney(s.gross_revenue_fen)),commerceMetric('近 30 天净收入',formatMoney(s.net_revenue_fen)),commerceMetric('支付成功率',`${s.payment_success_rate||0}%`),commerceMetric('有效期限订阅',String(s.active_subscriptions||0)),commerceMetric('终身授权用户',String(s.active_lifetime||0)),commerceMetric('7 天内到期',String(s.expiring_7d||0)));dashboard.replaceChildren(grid);}
    catch(error){dashboard.replaceChildren(node('div','panel',error.message));}
}
async function loadBenefits(){
    const list=document.querySelector('#entitlement-adjustment-list');
    try{const adjustments=await request('/v1/admin/entitlement-adjustments');const rows=(adjustments.items||[]).map(item=>{const row=node('div','adjustment-row');const info=node('div');info.append(node('strong','',`用户 ${item.user_id} · ${item.entitlement_type==='lifetime'?'终身授权':'期限订阅'}`),node('span','muted',`${item.adjustment_type} · ${formatDateTime(item.created_at)} · ${item.reason}`));const actions=node('div','row-actions');const status=node('span',`status ${item.status}`,item.status==='active'?'有效':'已撤销');actions.append(status);if(item.status==='active'){const revoke=node('button','danger compact','撤销');revoke.type='button';revoke.onclick=()=>showAdjustmentRevocation(item);actions.append(revoke);}row.append(info,actions);return row;});list.replaceChildren(...(rows.length?rows:[node('p','muted','暂无人工权益流水。')]));}
    catch(error){list.replaceChildren(node('p','muted',error.message));}
}

async function loadSupportTickets(){
    const target=document.querySelector('#support-ticket-list');const params=new URLSearchParams(new FormData(document.querySelector('#support-filter-form')));target.replaceChildren(node('p','muted','正在加载工单…'));
    try{const data=await request('/v1/admin/support/tickets?'+params);const table=node('div','data-table');const t=node('table');const head=node('tr');['编号','主题','分类','优先级','状态','更新时间','操作'].forEach(x=>head.append(node('th','',x)));const body=node('tbody');(data.items||[]).forEach(item=>{const row=node('tr');const open=node('button','secondary','处理');open.onclick=()=>showSupportTicket(item.id);row.append(node('td','',item.public_id),node('td','',item.subject),node('td','',item.category),node('td','',item.priority.toUpperCase()),node('td','',item.status),node('td','',formatDateTime(item.updated_at)),node('td',''));row.lastChild.append(open);body.append(row);});const tableHead=node('thead');tableHead.append(head);t.append(tableHead,body);table.append(t);target.replaceChildren(table);}catch(error){target.replaceChildren(node('p','muted',error.message));}
}

function showAdjustmentRevocation(item){
    openEditor('adjustment-revoke',item);
}

async function showSupportTicket(id){
    const data=await request(`/v1/admin/support/tickets/${id}`);const ticket=data.ticket;const panel=node('section','panel ticket-workspace');panel.append(node('h2','',`${ticket.public_id} · ${ticket.subject}`),node('p','muted',`${ticket.category} · ${ticket.priority.toUpperCase()} · ${ticket.status}`));const timeline=node('div','ticket-timeline');(data.messages||[]).forEach(message=>{const item=node('article',`ticket-message ${message.visibility}`);item.append(node('strong','',message.visibility==='internal'?'内部备注':message.author_type==='admin'?'客服回复':'用户消息'),node('time','',formatDateTime(message.created_at)),node('p','',message.body));timeline.append(item);});const form=node('form','ticket-reply-form');form.innerHTML='<label>回复内容<textarea name="message" required maxlength="20000"></textarea></label><label class="check"><input name="internal" type="checkbox"> 仅内部可见</label><button type="submit">提交回复</button><button type="button" class="secondary">返回队列</button><p class="status-message"></p>';form.querySelector('button[type="button"]').onclick=loadSupportTickets;form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));values.internal=form.elements.internal.checked;try{await request(`/v1/admin/support/tickets/${id}/reply`,{method:'POST',body:JSON.stringify(values)});showSupportTicket(id);}catch(error){form.querySelector('.status-message').textContent=error.message;}};panel.append(timeline,form);document.querySelector('#support-ticket-list').replaceChildren(panel);
}

document.addEventListener('click', async event => {
    const publish = event.target.closest('[data-publish-document]'); if (!publish) return;
    confirmOperation('发布新的法律文档版本', '发布后正文不可修改，并会替换该类型当前生效版本。用户后续登录将按新版本记录同意。', () => request(`/v1/admin/compliance-documents/${publish.dataset.publishDocument}`, {method:'PUT', body:JSON.stringify({action:'publish'})}));
});

function renderIdentityTable(items) {
    if (!items.length) return node('p', 'muted', '没有符合条件的实名认证记录。');
    const wrap = node('div', 'data-table'); const table = node('table');
    const head = node('thead'); const headRow = node('tr');
    ['记录 ID','用户 ID','手机号','姓名','当前状态','核验结果','核验时间','请求 ID'].forEach(label => headRow.append(node('th', '', label)));
    head.append(headRow); const body = node('tbody');
    items.forEach(item => {
        const row = node('tr'); const statusCell = node('td');
        statusCell.append(node('span', `status ${item.status || ''}`, identityStatusLabels[item.status] || item.status || '—'));
        const result = identityResultLabels[item.result_code] || `结果码 ${item.result_code || '—'}`;
        row.append(node('td', '', String(item.id)), node('td', '', String(item.user_id)),
            node('td', '', item.phone_masked || '—'), node('td', '', item.name_masked || '—'),
            statusCell, node('td', '', result), node('td', '', formatDateTime(item.created_at)),
            node('td', 'watermark-id', item.provider_request_id || '—'));
        body.append(row);
    });
    table.append(head, body); wrap.append(table); return wrap;
}

async function loadIdentityVerifications() {
    const form = document.querySelector('#identity-search-form');
    const message = document.querySelector('#identity-search-message');
    const target = document.querySelector('#identity-results');
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (String(value).trim()) params.set(key, String(value).trim());
    target.replaceChildren(node('p', 'muted', '正在查询…')); message.textContent = '正在读取受控实名记录…';
    try {
        const data = await request(`/v1/admin/identity-verifications?${params}`);
        message.textContent = `共 ${Number(data.total || 0).toLocaleString()} 条记录，当前最多显示 ${Number((data.items || []).length)} 条。`;
        target.replaceChildren(renderIdentityTable(data.items || []));
    } catch (error) {
        message.textContent = error.message;
        target.replaceChildren(node('p', 'muted', error.message === '此操作需要重新验证管理员密码和双因素验证码'
            ? '请先打开“管理员二次验证”完成验证，然后返回查询。' : error.message));
    }
}

function renderRegulatoryCaseTable(items) {
    if (!items.length) return node('p', 'muted', '暂无监管协查案件。');
    const wrap = node('div', 'data-table'); const table = node('table');
    const head = node('thead'); const headRow = node('tr');
    ['案件编号','监管机关','文号','调取对象','状态','文书','证据包','创建时间','操作'].forEach(label => headRow.append(node('th', '', label)));
    head.append(headRow); const body = node('tbody');
    items.forEach(item => {
        const row = node('tr'); const status = node('span', `status ${item.status || ''}`, regulatoryCaseStatusLabels[item.status] || item.status);
        const target = [item.subject_user_id ? `用户 ${item.subject_user_id}` : '', item.subject_phone_masked || ''].filter(Boolean).join(' · ') || '按日期范围';
        const actions = node('td'); const detail = node('button', 'secondary', '查看');
        detail.dataset.regulatoryCaseDetail = item.id; actions.append(detail);
        row.append(node('td', 'watermark-id', item.case_number), node('td', '', item.authority_name),
            node('td', '', item.request_document_no), node('td', '', target), node('td'), node('td', '', String(item.document_count || 0)),
            node('td', '', String(item.export_count || 0)), node('td', '', formatDateTime(item.created_at)), actions);
        row.children[4].append(status); body.append(row);
    });
    table.append(head, body); wrap.append(table); return wrap;
}

async function loadRegulatoryCases() {
    const message = document.querySelector('#regulatory-case-message');
    const target = document.querySelector('#regulatory-case-results');
    target.replaceChildren(node('p', 'muted', '正在加载案件…'));
    try {
        const data = await request('/v1/admin/regulatory-cases');
        message.textContent = `当前显示 ${Number((data.items || []).length)} 个案件；全部操作均写入审计日志。`;
        target.replaceChildren(renderRegulatoryCaseTable(data.items || []));
    } catch (error) {
        message.textContent = error.message;
        target.replaceChildren(node('p', 'muted', error.message));
    }
}

async function uploadRegulatoryDocument(caseId, file) {
    if (!file || file.size < 1) throw Error('请选择要上传的监管文书');
    if (file.size > 10 * 1024 * 1024) throw Error('监管文书不能超过 10 MiB');
    const data = new FormData(); data.append('document', file);
    const response = await fetch(`${API}/v1/admin/regulatory-cases/${caseId}/documents`, {
        method: 'POST', credentials: 'omit', headers: {Accept: 'application/json', Authorization: `Bearer ${token}`}, body: data
    });
    const body = await parseJsonResponse(response, '文书上传失败');
    if (!response.ok) throw Error(body.error?.message || '文书上传失败');
    return body.data;
}

async function downloadRegulatoryExport(exportId, filename) {
    const response = await fetch(`${API}/v1/admin/regulatory-case-exports/${exportId}/download`, {
        headers: {Accept: 'application/zip', Authorization: `Bearer ${token}`}
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Error(body.error?.message || '证据包下载失败');
    }
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadRegulatoryDocument(documentId, filename) {
    const response = await fetch(`${API}/v1/admin/regulatory-case-documents/${documentId}/download`, {
        headers: {Accept: 'application/octet-stream', Authorization: `Bearer ${token}`}
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Error(body.error?.message || '监管文书下载失败');
    }
    const blob = await response.blob(); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showRegulatoryCaseDetail(caseId) {
    const target = document.querySelector('#regulatory-case-content');
    const message = document.querySelector('#regulatory-case-detail-message');
    target.replaceChildren(node('p', 'muted', '正在加载…')); message.textContent = '';
    if (!regulatoryCaseDialog.open) regulatoryCaseDialog.showModal();
    try {
        const data = await request(`/v1/admin/regulatory-cases/${caseId}`);
        const item = data.case || {}; const grid = node('div', 'watermark-detail-grid');
        grid.append(detailItem('案件编号', item.case_number, 'watermark-id'), detailItem('状态', regulatoryCaseStatusLabels[item.status] || item.status),
            detailItem('监管机关', item.authority_name), detailItem('监管文号', item.request_document_no),
            detailItem('法律依据', item.legal_basis), detailItem('调取范围', item.scope_text),
            detailItem('用户 ID', item.subject_user_id || '—'), detailItem('手机号', item.subject_phone_masked || '—'),
            detailItem('开始日期', item.period_from || '—'), detailItem('结束日期', item.period_to || '—'),
            detailItem('内部保留至', item.retention_until || '按公司制度确定'), detailItem('法律保全', Number(item.legal_hold) ? '启用' : '未启用'),
            detailItem('创建人', String(item.created_by || '—')), detailItem('审批人', String(item.approved_by || '—')));
        const documents = node('div', 'case-section'); documents.append(node('h3', '', '内部监管文书'));
        (data.documents || []).forEach(documentItem => {
            const row = node('div', 'case-export-row'); const info = node('span', 'case-file-row', `${documentItem.original_name} · ${documentItem.size_bytes} 字节 · SHA-256 ${documentItem.sha256}`);
            const button = node('button', 'secondary', '下载内部原件'); button.onclick = () => downloadRegulatoryDocument(documentItem.id, documentItem.original_name).catch(error => { message.textContent = error.message; });
            row.append(info, button); documents.append(row);
        });
        if (!(data.documents || []).length) documents.append(node('p', 'muted', '尚未上传文书。'));
        if (item.status === 'open') {
            const uploadForm = node('form', 'case-upload-form'); const file = node('input'); file.type = 'file'; file.accept = '.pdf,.jpg,.jpeg,.png'; file.required = true;
            const upload = node('button', 'secondary', '上传并加密保存');
            uploadForm.append(file, upload); uploadForm.onsubmit = async event => {
                event.preventDefault(); upload.disabled = true; message.textContent = '正在上传文书…';
                try { await uploadRegulatoryDocument(caseId, file.files[0]); await showRegulatoryCaseDetail(caseId); }
                catch (error) { message.textContent = error.message; } finally { upload.disabled = false; }
            };
            documents.append(uploadForm);
        }
        const exports = node('div', 'case-section'); exports.append(node('h3', '', '证据包'));
        (data.exports || []).forEach(exportItem => {
            const row = node('div', 'case-export-row'); const info = node('span', '', `${formatDateTime(exportItem.created_at)} · SHA-256 ${exportItem.sha256}`);
            const button = node('button', 'secondary', '重新下载'); button.onclick = () => downloadRegulatoryExport(exportItem.id, `${item.case_number}.zip`).catch(error => { message.textContent = error.message; });
            row.append(info, button); exports.append(row);
        });
        if (!(data.exports || []).length) exports.append(node('p', 'muted', '尚未生成证据包。'));
        const actions = node('div', 'case-actions');
        if (item.status === 'open') {
            const include = checkField('include_document', '审批时允许在对外证据包附带监管文书副本', false);
            const approve = node('button', '', '审批案件'); approve.onclick = async () => {
                approve.disabled = true; message.textContent = '正在审批…';
                try { await request(`/v1/admin/regulatory-cases/${caseId}/approve`, {method: 'POST', body: JSON.stringify({include_document: include.querySelector('input').checked})}); await showRegulatoryCaseDetail(caseId); await loadRegulatoryCases(); }
                catch (error) { message.textContent = error.message; } finally { approve.disabled = false; }
            };
            actions.append(include, approve);
        }
        if (['approved','exported'].includes(item.status)) {
            const exportButton = node('button', '', '生成并下载证据包'); exportButton.onclick = async () => {
                exportButton.disabled = true; message.textContent = '正在生成证据包…';
                try {
                    const result = await request(`/v1/admin/regulatory-cases/${caseId}/export`, {method: 'POST', body: '{}'});
                    await downloadRegulatoryExport(result.export_id, `${result.case_number}.zip`);
                    await showRegulatoryCaseDetail(caseId); await loadRegulatoryCases();
                } catch (error) { message.textContent = error.message; } finally { exportButton.disabled = false; }
            };
            actions.append(exportButton);
        }
        target.replaceChildren(grid, documents, exports, actions);
    } catch (error) { target.replaceChildren(node('p', 'muted', error.message)); }
}

function renderWatermarkTable(items) {
    if (!items.length) return node('p', 'muted', '没有符合条件的水印记录。');
    const wrap = node('div', 'data-table'); const table = node('table');
    const head = node('thead'); const headRow = node('tr');
    ['内容 ID','用户 ID','类型','状态','签发时间','完成时间','时长','操作'].forEach(label => headRow.append(node('th', '', label)));
    head.append(headRow); const body = node('tbody');
    items.forEach(item => {
        const row = node('tr');
        row.append(node('td', 'watermark-id', item.content_id), node('td', '', String(item.user_id)),
            node('td', '', watermarkTypeLabels[item.content_type] || item.content_type),
            node('td', '', watermarkStatusLabels[item.status] || item.status),
            node('td', '', formatDateTime(item.issued_at)), node('td', '', formatDateTime(item.finalized_at)),
            node('td', '', item.duration_ms === null ? '—' : `${(Number(item.duration_ms) / 1000).toFixed(2)} 秒`));
        const action = node('td'); const detail = node('button', 'secondary', '查看详情');
        detail.dataset.watermarkDetail = item.content_id; action.append(detail); row.append(action); body.append(row);
    });
    table.append(head, body); wrap.append(table); return wrap;
}

async function loadWatermarks() {
    const form = document.querySelector('#watermark-search-form');
    const message = document.querySelector('#watermark-search-message');
    const target = document.querySelector('#watermark-results');
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (String(value).trim()) params.set(key, String(value).trim());
    target.replaceChildren(node('p', 'muted', '正在查询…')); message.textContent = '正在读取受控台账…';
    try {
        const data = await request(`/v1/admin/watermarks?${params}`);
        message.textContent = `共 ${Number(data.total || 0).toLocaleString()} 条记录，当前显示 ${Number((data.items || []).length)} 条。`;
        target.replaceChildren(renderWatermarkTable(data.items || []));
    } catch (error) {
        message.textContent = error.message;
        target.replaceChildren(node('p', 'muted', error.message === '此操作需要重新验证管理员密码和双因素验证码'
            ? '请先打开“管理员二次验证”完成验证，然后返回查询。' : error.message));
    }
}

function detailItem(label, value, className = '') {
    const item = node('div', `watermark-detail-item ${className}`.trim());
    item.append(node('small', '', label), node('strong', '', value ?? '—')); return item;
}

async function showWatermarkDetail(contentId) {
    const target = document.querySelector('#watermark-detail-content');
    target.replaceChildren(node('p', 'muted', '正在加载…')); watermarkDetailDialog.showModal();
    try {
        const data = await request(`/v1/admin/watermarks/${encodeURIComponent(contentId)}`);
        const item = data.content || {}; const consent = data.consent || {};
        const grid = node('div', 'watermark-detail-grid');
        grid.append(detailItem('内容 ID', item.content_id, 'watermark-id'), detailItem('用户', `${item.user_id ?? '—'} · ${item.user_phone_masked || '—'}`),
            detailItem('内容类型', watermarkTypeLabels[item.content_type] || item.content_type), detailItem('台账状态', watermarkStatusLabels[item.status] || item.status),
            detailItem('声学协议', item.acoustic_protocol || '历史记录（未启用 RAT2）'), detailItem('声学查询令牌', item.acoustic_token || '—', 'watermark-id'),
            detailItem('签发时间', formatDateTime(item.issued_at)), detailItem('完成时间', formatDateTime(item.finalized_at)),
            detailItem('音频时长', item.duration_ms === null ? '—' : `${(Number(item.duration_ms) / 1000).toFixed(3)} 秒`), detailItem('客户端版本', item.client_version),
            detailItem('政策版本', item.policy_version), detailItem('密钥版本', String(item.key_version ?? '—')),
            detailItem('音频 SHA-256', item.audio_sha256 || '—', 'watermark-id'), detailItem('工程假名摘要', item.project_id_hash || '—', 'watermark-id'),
            detailItem('同意时间', formatDateTime(consent.accepted_at)), detailItem('撤回时间', formatDateTime(consent.revoked_at)));
        const events = node('div', 'watermark-events'); events.append(node('h3', '', '水印审计事件'));
        const lineage = node('div', 'watermark-events');
        lineage.append(node('h3', '', '派生关系'));
        lineage.append(detailItem(
            '父内容 ID',
            (data.parents || []).join(' · ') || '—',
            'watermark-id'
        ));
        lineage.append(detailItem(
            '派生内容 ID',
            (data.children || []).join(' · ') || '—',
            'watermark-id'
        ));
        (data.events || []).forEach(event => {
            const row = node('div', 'watermark-event');
            row.append(node('span', '', event.action), node('span', '', event.result), node('span', 'muted', formatDateTime(event.created_at)));
            events.append(row);
        });
        if (!(data.events || []).length) events.append(node('p', 'muted', '暂无事件。'));
        target.replaceChildren(grid, lineage, events);
    } catch (error) { target.replaceChildren(node('p', 'muted', error.message)); }
}

async function verifyWatermarkAcousticToken(event) {
    event.preventDefault();
    const result = document.querySelector('#watermark-verify-result');
    const acousticToken = document.querySelector('#watermark-acoustic-token').value.trim().toLowerCase();
    if (!/^[a-f0-9]{24}$/.test(acousticToken)) {
        result.className = 'watermark-verification invalid';
        result.textContent = '请输入独立检测工具输出的 24 位十六进制 RAT2 声学查询令牌。';
        return;
    }
    result.className = 'watermark-verification muted'; result.textContent = '正在进行 RAT2 服务端验证…';
    try {
        const data = await request('/v1/admin/watermarks/verify', {method: 'POST', body: JSON.stringify({acoustic_token: acousticToken})});
        const verified = data.status === 'verified';
        result.className = `watermark-verification ${verified ? 'verified' : 'invalid'}`;
        result.textContent = verified
            ? `RAT2 验证通过\n声学查询令牌：${data.acoustic_token}\n内容 ID：${data.content_id}\n类型：${watermarkTypeLabels[data.content_type] || data.content_type}\n台账状态：${watermarkStatusLabels[data.ledger_status] || data.ledger_status}\n签发时间：${formatDateTime(data.issued_at)}`
            : `验证未通过\n原因：${data.reason || 'unknown'}`;
        if (verified) document.querySelector('#watermark-content-id').value = data.content_id;
    } catch (error) {
        result.className = 'watermark-verification invalid';
        result.textContent = error.message;
    }
}

function inputField(name, label, type = 'text', options = {}) {
    const wrap = node('label', options.full ? 'full' : ''); wrap.append(document.createTextNode(label)); const input = type === 'textarea' ? node('textarea') : node('input'); input.name = name; if (type !== 'textarea') input.type = type; if (options.required) input.required = true; if (options.placeholder) input.placeholder = options.placeholder; if (options.value !== undefined && options.value !== null) input.value = options.value; if (options.disabled) input.disabled = true; if (options.readonly) input.readOnly = true; wrap.append(input); return wrap;
}
function selectField(name, label, values, selected, options = {}) {
    const wrap = node('label', options.full ? 'full' : ''); wrap.append(document.createTextNode(label)); const select = node('select'); select.name = name; select.disabled = Boolean(options.disabled); values.forEach(([value,text]) => { const option = node('option', '', text); option.value = value; option.selected = value === selected; select.append(option); }); wrap.append(select); return wrap;
}
function checkField(name, label, checked = false, danger = false) {
    const wrap = node('label', `check full${danger ? ' danger-check' : ''}`); const input = node('input'); input.type = 'checkbox'; input.name = name; input.checked = checked; wrap.append(input, document.createTextNode(label)); return wrap;
}
function formatResourceParts(parts) {
    return (Array.isArray(parts) ? parts : []).map(part =>
        `${part.index}|${part.object_key}|${part.sha256}|${part.size_bytes}`).join('\n');
}
function parseResourceParts(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, position) => {
        const fields = line.split('|').map(value => value.trim());
        if (fields.length !== 4 || Number(fields[0]) !== position + 1 || !/^\d+$/.test(fields[3]))
            throw new Error(`第 ${position + 1} 条分片格式不正确，请按“序号|对象路径|SHA-256|字节数”填写。`);
        return {index:Number(fields[0]),object_key:fields[1],sha256:fields[2],size_bytes:Number(fields[3])};
    });
}

const artifactHexFields = new Set([
    'full_package_sha256', 'full_package_manifest_sha256', 'full_package_manifest_signature',
    'patch_sha256', 'manifest_sha256', 'manifest_signature', 'sha256'
]);
const artifactTextFields = new Set([
    'full_package_object_key', 'full_package_manifest_url', 'patch_object_key', 'manifest_url',
    'signing_key_id', 'version', 'from_version', 'minimum_app_version', 'slug', 'object_key'
]);
function normalizeArtifactValues(values) {
    const normalized = {...values};
    artifactHexFields.forEach(key => {
        if (normalized[key] !== undefined)
            normalized[key] = String(normalized[key]).replace(/[\s\u200B\u200C\u200D\uFEFF]+/gu, '').toLowerCase();
    });
    artifactTextFields.forEach(key => {
        if (normalized[key] !== undefined) normalized[key] = String(normalized[key]).trim();
    });
    return normalized;
}
function requireHexField(values, key, label, length) {
    const value = String(values[key] || '');
    if (value && !new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value))
        throw new Error(`${label}必须是 ${length} 位十六进制字符，当前为 ${value.length} 位。`);
}

function openEditor(kind, data = {}) {
    editorState = {kind, data}; editorFields.replaceChildren(); editorMessage.textContent = '';
    if (kind === 'adjustment-revoke') {
        document.querySelector('#editor-eyebrow').textContent='ENTITLEMENT REVOCATION';document.querySelector('#editor-title').textContent=`撤销用户 ${data.user_id} 的人工权益`;
        editorFields.append(node('div','security-note full','撤销后对应授权将立即失效，撤销事实与原因将永久写入权益流水和审计日志。'),inputField('reason','撤销原因','textarea',{required:true,full:true,placeholder:'请说明撤销依据，至少 5 个字'}));
    } else if (kind === 'regulatory-cases') {
        document.querySelector('#editor-eyebrow').textContent = 'REGULATORY CASE'; document.querySelector('#editor-title').textContent = '新建监管协查案件';
        editorFields.append(inputField('authority_name','监管机关','text',{required:true}), inputField('request_document_no','监管文号','text',{required:true}),
            inputField('legal_basis','法律依据','textarea',{required:true,full:true,placeholder:'填写来函载明的法律依据'}), inputField('scope_text','调取范围说明','textarea',{required:true,full:true,placeholder:'准确记录调取对象、字段、用途和范围'}),
            inputField('subject_user_id','用户 ID','number'), inputField('subject_phone','完整手机号','text',{placeholder:'精确查询，后台仅脱敏展示'}),
            inputField('period_from','开始日期','date'), inputField('period_to','结束日期','date'), inputField('retention_until','内部保留至','date',{full:true}));
    } else if (kind === 'releases') {
        const editing = Boolean(data.id); const immutable = editing && data.status !== 'draft';
        document.querySelector('#editor-eyebrow').textContent = 'RELEASE EDITOR'; document.querySelector('#editor-title').textContent = editing ? `编辑版本 ${data.version}` : '新建版本发布';
        if (immutable) editorFields.append(node('div','security-note full','已发布版本的包路径、哈希、签名、版本号和平台不可修改；这里只允许调整更新说明、灰度比例与强制更新状态。'));
        if (!immutable) editorFields.append(inputField('version','目标版本','text',{required:true,value:data.version||'',placeholder:'0.9.5'}), selectField('platform','平台',[['windows-x64','Windows x64'],['macos-universal2','macOS Universal 2']], data.platform||'windows-x64'), selectField('channel','发布通道',[['stable','稳定版'],['beta','测试版'],['internal','内部版']], data.channel||'stable'), ...(!editing ? [selectField('status','提交状态',[['draft','保存为草稿'],['published','立即发布']], 'draft')] : []), inputField('signing_key_id','签名密钥编号','text',{required:true,value:data.signing_key_id||'roleai-release-1'}), node('p','muted full','完整安装包（发布后以下交付字段锁定）'), inputField('full_package_object_key','完整安装包 OSS 对象路径','text',{required:true,full:true,value:data.full_package_object_key||'',placeholder:'releases/0.9.5/<平台>/installer/...'}), inputField('full_package_sha256','完整安装包 SHA-256','text',{required:true,full:true,value:data.full_package_sha256||''}), inputField('full_package_size','完整安装包字节数','number',{required:true,value:data.full_package_size||''}), inputField('full_package_manifest_url','安装包 Manifest OSS 对象路径','text',{required:true,full:true,value:data.full_package_manifest_url||''}), inputField('full_package_manifest_sha256','安装包 Manifest SHA-256','text',{required:true,full:true,value:data.full_package_manifest_sha256||''}), inputField('full_package_manifest_signature','安装包 Manifest Ed25519 签名','text',{required:true,full:true,value:data.full_package_manifest_signature||''}), node('p','muted full','增量补丁（首个版本全部留空；后续版本必须全部填写）'), inputField('from_version','来源版本','text',{value:data.from_version||''}), inputField('patch_size_bytes','增量补丁字节数','number',{value:data.patch_size_bytes||''}), inputField('patch_object_key','增量补丁 OSS 对象路径','text',{full:true,value:data.patch_object_key||''}), inputField('patch_sha256','增量补丁 SHA-256','text',{full:true,value:data.patch_sha256||''}), inputField('manifest_url','补丁 Manifest OSS 对象路径','text',{full:true,value:data.patch_manifest_url||''}), inputField('manifest_sha256','补丁 Manifest SHA-256','text',{full:true,value:data.patch_manifest_sha256||''}), inputField('manifest_signature','补丁 Manifest Ed25519 签名','text',{full:true,value:data.patch_manifest_signature||''}));
        editorFields.append(inputField('rollout_percent','灰度百分比','number',{value:data.rollout_percent ?? 100}), inputField('release_notes','更新说明','textarea',{required:true,full:true,value:data.release_notes||'',placeholder:'本次版本的新增功能、改进与修复…'}), checkField('mandatory','标记为必须更新',Number(data.mandatory)===1));
    } else if (kind === 'resources') {
        const editing = Boolean(data.id); const immutable = editing && data.status !== 'draft';
        document.querySelector('#editor-eyebrow').textContent = 'RESOURCE EDITOR'; document.querySelector('#editor-title').textContent = editing ? `编辑 ${data.name}` : '新建下载资源';
        if (immutable) editorFields.append(node('div','security-note full','已发布资源的标识、版本、包路径、哈希、签名和兼容性字段不可修改；可修正展示名称。'));
        editorFields.append(inputField('name','资源名称','text',{required:true,value:data.name||''}));
        if (!immutable) editorFields.append(inputField('slug','资源标识','text',{required:true,value:data.slug||'',placeholder:'official-plugin'}), selectField('type','资源类型',[['plugin','VST 插件'],['model','AI 模型'],['soundbank','音色库'],['training','RVC 训练插件']], data.type||'plugin'), selectField('platform','适用平台',[['universal','通用模型 / 内容'],['windows-x64','Windows x64'],['macos-universal2','macOS Universal 2']], data.platform||'universal'), inputField('version','版本','text',{required:true,value:data.version||'',placeholder:'1.0.0'}), selectField('delivery_mode','交付方式',[['single','单文件'],['multipart','多分片（大于 OSS 单文件限制）']],data.delivery_mode||'single'), node('p','muted full','单文件资源填写下面的对象路径；多分片资源将该项留空，并按发布元数据填写分片清单。'), inputField('object_key','单文件安装包 OSS 对象路径（多分片留空）','text',{full:true,value:data.object_key||''}), inputField('delivery_parts','多分片清单（每行：序号|对象路径|SHA-256|字节数）','textarea',{full:true,value:formatResourceParts(data.parts)}), inputField('sha256','完整资源包 SHA-256','text',{required:true,full:true,value:data.sha256||''}), inputField('size_bytes','完整资源包字节数','number',{required:true,value:data.size_bytes||0}), inputField('manifest_url','Manifest OSS 对象路径（必填）','text',{required:true,full:true,value:data.manifest_url||''}), inputField('manifest_sha256','Manifest SHA-256（必填）','text',{required:true,full:true,value:data.manifest_sha256||''}), inputField('manifest_signature','Manifest Ed25519 签名（必填）','text',{required:true,full:true,value:data.manifest_signature||''}), inputField('signing_key_id','签名密钥编号（必填）','text',{required:true,value:data.signing_key_id||'roleai-release-1'}), inputField('minimum_app_version','最低软件版本','text',{value:data.minimum_app_version||'',placeholder:'0.9.0'}), ...(!editing ? [selectField('status','提交状态',[['draft','保存为草稿'],['published','立即发布']], 'draft')] : []));
    } else {
        document.querySelector('#editor-eyebrow').textContent = 'LICENSE PLAN'; document.querySelector('#editor-title').textContent = `编辑 ${data.name}`;
        const isFree=data.code==='free';
        if(isFree) editorFields.append(node('div','security-note full','免费版是所有账户的默认产品层级。可编辑展示内容，但价格固定为 0 元、周期固定为免费且永远不会进入支付订单。'));
        editorFields.append(inputField('name','方案名称','text',{required:true,value:data.name}), inputField('amount_yuan','价格（元）','number',{required:true,value:Number(data.amount_fen)/100,readonly:isFree}), selectField('billing_period','授权周期',isFree?[['free','免费']]:[['month','月度'],['year','年度'],['lifetime','终身']],data.billing_period,{disabled:isFree}), inputField('sort_order','展示顺序','number',{value:data.sort_order}), inputField('badge','卡片标签','text',{value:data.badge||'',placeholder:'例如：推荐'}), inputField('summary','方案说明','textarea',{required:true,full:true,value:data.summary}), inputField('benefits','方案优点（每行一条）','textarea',{required:true,full:true,value:(data.benefits||[]).join('\n')}), inputField('limitations','限制说明（每行一条）','textarea',{full:true,value:(data.limitations||[]).join('\n')}), checkField('active',isFree?'在官网展示免费方案':'在官网展示并允许购买',Number(data.active)===1));
        if (Number(data.early_bird) === 1 && Number(data.active) === 1) editorFields.append(checkField('close_early_bird','结束公测早鸟：提交后立即关闭官网卡片和购买入口',false,true));
    }
    editor.showModal();
}

editorForm.onsubmit = async event => {
    event.preventDefault(); const values = normalizeArtifactValues(Object.fromEntries(new FormData(editorForm))); editorMessage.textContent = '正在提交…'; document.querySelector('#editor-submit').disabled = true;
    try {
        let path; let method = 'POST'; let payload;
        if (editorState.kind === 'adjustment-revoke') {
            path=`/v1/admin/entitlement-adjustments/${editorState.data.id}/revoke`;payload={reason:values.reason};
        } else if (editorState.kind === 'regulatory-cases') {
            path = '/v1/admin/regulatory-cases'; payload = values;
        } else if (editorState.kind === 'plans') {
            const isFree=editorState.data.code==='free';path = `/v1/admin/plans/${editorState.data.id}`; method = 'PUT'; payload = {name: values.name, amount_fen: isFree?0:Math.round(Number(values.amount_yuan) * 100), billing_period: isFree?'free':values.billing_period, sort_order: Number(values.sort_order || 100), badge: values.badge || '', summary: values.summary, benefits: String(values.benefits || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean), limitations:String(values.limitations||'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean), active: values.active === 'on', close_early_bird: values.close_early_bird === 'on'};
        } else if (editorState.kind === 'releases') {
            requireHexField(values, 'full_package_sha256', '完整安装包 SHA-256', 64);
            requireHexField(values, 'full_package_manifest_sha256', '安装包 Manifest SHA-256', 64);
            requireHexField(values, 'full_package_manifest_signature', '安装包 Manifest Ed25519 签名', 128);
            requireHexField(values, 'patch_sha256', '增量补丁 SHA-256', 64);
            requireHexField(values, 'manifest_sha256', '补丁 Manifest SHA-256', 64);
            requireHexField(values, 'manifest_signature', '补丁 Manifest Ed25519 签名', 128);
            path = editorState.data.id ? `/v1/admin/releases/${editorState.data.id}` : '/v1/admin/releases'; method = editorState.data.id ? 'PUT' : 'POST'; payload = {...values, full_package_size: Number(values.full_package_size || 0), patch_size_bytes: values.patch_size_bytes === '' || values.patch_size_bytes === undefined ? '' : Number(values.patch_size_bytes), mandatory: values.mandatory === 'on'};
        } else {
            requireHexField(values, 'sha256', '完整资源包 SHA-256', 64);
            requireHexField(values, 'manifest_sha256', 'Manifest SHA-256', 64);
            requireHexField(values, 'manifest_signature', 'Manifest Ed25519 签名', 128);
            path = editorState.data.id ? `/v1/admin/resources/${editorState.data.id}` : '/v1/admin/resources';
            method = editorState.data.id ? 'PUT' : 'POST';
            const parts = values.delivery_mode === 'multipart' ? parseResourceParts(values.delivery_parts) : [];
            payload = {...values, size_bytes: Number(values.size_bytes || 0), parts}; delete payload.delivery_parts;
        }
        await request(path, {method, body: JSON.stringify(payload)}); editor.close(); await refreshCurrentView();
    } catch (error) { editorMessage.textContent = error.message; }
    finally { document.querySelector('#editor-submit').disabled = false; }
};
document.querySelectorAll('[data-close-editor]').forEach(button => button.onclick = () => editor.close());

function confirmOperation(title, message, action) {
    document.querySelector('#confirm-title').textContent = title; document.querySelector('#confirm-message').textContent = message; confirmAction = action; confirmDialog.showModal();
}
document.querySelector('#confirm-cancel').onclick = () => confirmDialog.close();
document.querySelector('#confirm-submit').onclick = async () => { const button = document.querySelector('#confirm-submit'); button.disabled = true; try { await confirmAction?.(); confirmDialog.close(); await refreshCurrentView(); } catch (error) { document.querySelector('#confirm-message').textContent = error.message; } finally { button.disabled = false; } };

document.addEventListener('click', event => {
    const create = event.target.closest('[data-create]'); if (create) openEditor(create.dataset.create);
    const editItem = event.target.closest('[data-edit-item]'); if (editItem) openEditor(editItem.dataset.editItem, editItem._item);
    const plan = event.target.closest('[data-edit-plan]'); if (plan) openEditor('plans', plan._plan);
    const action = event.target.closest('[data-action]'); if (action) {
        const plural = action.dataset.action === 'user' ? 'users' : `${action.dataset.action}s`;
        confirmOperation('确认状态变更', `即将把此${action.dataset.action === 'user' ? '用户' : action.dataset.action === 'license' ? '授权' : action.dataset.action === 'release' ? '版本' : '资源'}状态改为“${displayValue('status', action.dataset.status)}”。`, () => request(`/v1/admin/${plural}/${action.dataset.id}`, {method: 'PUT', body: JSON.stringify({status: action.dataset.status})}));
    }
    const watermarkDetail = event.target.closest('[data-watermark-detail]');
    if (watermarkDetail) showWatermarkDetail(watermarkDetail.dataset.watermarkDetail);
    const regulatoryCaseDetail = event.target.closest('[data-regulatory-case-detail]');
    if (regulatoryCaseDetail) showRegulatoryCaseDetail(regulatoryCaseDetail.dataset.regulatoryCaseDetail);
});

document.querySelector('#watermark-search-form').onsubmit = event => { event.preventDefault(); loadWatermarks(); };
document.querySelector('#watermark-search-reset').onclick = () => {
    document.querySelector('#watermark-search-form').reset();
    document.querySelector('#watermark-results').replaceChildren(node('p', 'muted', '输入条件后查询水印台账。'));
    document.querySelector('#watermark-search-message').textContent = '查询和详情查看均要求管理员二次验证，并会写入审计日志。';
};
document.querySelector('#watermark-verify-form').onsubmit = verifyWatermarkAcousticToken;
document.querySelectorAll('[data-close-watermark-detail]').forEach(button => button.onclick = () => watermarkDetailDialog.close());
document.querySelectorAll('[data-close-regulatory-case]').forEach(button => button.onclick = () => regulatoryCaseDialog.close());
document.querySelector('#identity-search-form').onsubmit = event => { event.preventDefault(); loadIdentityVerifications(); };
document.querySelector('#identity-search-reset').onclick = () => {
    document.querySelector('#identity-search-form').reset();
    document.querySelector('#identity-results').replaceChildren(node('p', 'muted', '可按用户、手机号、状态、结果码或日期查询。'));
    document.querySelector('#identity-search-message').textContent = '查询实名记录要求管理员二次验证，并会写入审计日志。';
};

let currentView = 'overview';
async function refreshCurrentView() {
    if (currentView === 'overview') return loadOverview();
    if (currentView === 'orders') { await Promise.all([loadCommerceStats(), loadList('orders')]); return; }
    if (currentView === 'benefits') return loadBenefits();
    if (currentView === 'support') return loadSupportTickets();
    if (currentView === 'plans') return loadPlans();
    if (currentView === 'licenses') return loadList('licenses');
    if (currentView === 'identities') return loadIdentityVerifications();
    if (currentView === 'regulatory-cases') return loadRegulatoryCases();
    if (currentView === 'watermarks') return loadWatermarks();
    if (currentView === 'documents') return loadDocuments();
    return loadList(currentView);
}
document.querySelectorAll('[data-view]').forEach(button => button.onclick = async () => {
    currentView = button.dataset.view; document.querySelectorAll('[data-view]').forEach(item => item.classList.toggle('active', item === button)); document.querySelectorAll('.view').forEach(view => view.classList.add('hidden')); document.querySelector(`#view-${currentView}`).classList.remove('hidden'); document.querySelector('#view-title').textContent = titles[currentView]; await refreshCurrentView();
});
document.querySelector('#refresh-view').onclick = refreshCurrentView;
document.querySelector('#support-filter-form').onsubmit=event=>{event.preventDefault();loadSupportTickets();};
document.querySelectorAll('[data-filter-for]').forEach(form=>{form.onsubmit=event=>{event.preventDefault();loadList(form.dataset.filterFor);};form.onreset=()=>setTimeout(()=>loadList(form.dataset.filterFor),0);});
document.querySelector('#entitlement-adjustment-form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));values.request_token=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');const type=values.entitlement_type==='lifetime'?'终身授权':`期限订阅（到期：${values.expires_at||'未填写'}）`;confirmOperation('确认人工开通权益',`将为用户 ${values.user_id} 开通${type}。该操作不会创建支付订单，原因：${values.reason}`,async()=>{await request('/v1/admin/entitlement-adjustments',{method:'POST',body:JSON.stringify(values)});form.reset();setAdjustmentStartTime();await loadBenefits();});};
function setAdjustmentStartTime(){const input=document.querySelector('#entitlement-adjustment-form [name="starts_at"]');if(input&&!input.value){const now=new Date(Date.now()-new Date().getTimezoneOffset()*60000);input.value=now.toISOString().slice(0,16);}}
document.querySelector('#logout').onclick = async () => {
    try { await fetch(API + '/v1/admin/logout', {method: 'POST', headers: {Accept: 'application/json', Authorization: `Bearer ${token}`}}); }
    finally { sessionStorage.removeItem('roleai_admin_token'); sessionStorage.removeItem('roleai_admin_mfa_setup_required'); location.replace('/admin/login.html'); }
};

async function initialize() {
    try { const data = await request('/v1/admin/me'); document.querySelector('#admin-name').textContent = data.admin.username; const role = document.querySelector('#admin-role'); role.dataset.role = data.admin.role; role.dataset.mfa = data.admin.mfa_enabled ? '1' : '0'; stepUpExpiresAt = Date.now() + Number(data.admin.step_up_expires_in || 0) * 1000; role.textContent = data.admin.mfa_enabled ? `${data.admin.role} · MFA 已启用` : `${data.admin.role} · 未启用 MFA`; updateStepUpLabel(); await loadOverview(); }
    catch (error) { document.querySelector('#stats-message').textContent = error.message; }
}
initialize();
setAdjustmentStartTime();
