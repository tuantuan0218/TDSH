const API = 'https://api.roleai.studio';
const token = sessionStorage.getItem('roleai_admin_token') || '';
const message = document.querySelector('#security-message');
let status = null;
let admins = [];
if (!token) location.replace('/admin/login.html');

async function request(path, options = {}) {
    const response = await fetch(API + path, {
        ...options,
        headers: {Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers}
    });
    const body = await response.json();
    if (response.status === 401 && body.error?.code === 'admin_unauthorized') {
        sessionStorage.removeItem('roleai_admin_token'); location.replace('/admin/login.html');
    }
    if (!response.ok) throw Error(body.error?.message || '请求失败');
    return body.data || {};
}

function showRecoveryCodes(codes) {
    const section = document.querySelector('#recovery-section');
    document.querySelector('#recovery-codes').textContent = (codes || []).join('\n');
    section.hidden = false;
    section.scrollIntoView({behavior: 'smooth', block: 'center'});
}

function renderStatus() {
    document.querySelector('#mfa-status').textContent = status.mfa_enabled ? '已启用' : '尚未启用';
    document.querySelector('#recovery-count').textContent = status.mfa_enabled ? `${status.recovery_codes_remaining} 条` : '不可用';
    document.querySelector('#step-up-status').textContent = status.step_up_active ? `有效至 ${status.step_up_expires_at}` : '需要验证';
    document.querySelector('#setup-section').hidden = status.mfa_enabled;
    document.querySelector('#step-up-section').hidden = !status.mfa_enabled;
    document.querySelector('#owner-recovery-section').hidden = status.role !== 'owner';
}

async function loadStatus() {
    status = await request('/v1/admin/security');
    renderStatus();
    if (status.role === 'owner') { await loadAdmins(); await loadSecurityEvents(); }
    if (new URLSearchParams(location.search).get('setup') === 'required' && !status.mfa_enabled) message.textContent = '请先启用双因素认证，之后才能执行高风险管理操作。';
}

async function loadSecurityEvents() {
    document.querySelector('#security-events-section').hidden = false;
    const data = await request('/v1/admin/security/events');
    const target = document.querySelector('#security-events');
    const items = data.items || [];
    target.replaceChildren(...(items.length ? items.map(item => {
        const row = document.createElement('article'); row.className = 'security-event-row';
        const detail = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = item.event_type;
        const meta = document.createElement('span'); meta.textContent = `${item.severity.toUpperCase()} · ${item.created_at}${item.acknowledged_at ? ' · 已确认' : ''}`;
        detail.append(title, meta); row.append(detail);
        if (!item.acknowledged_at && ['high','critical'].includes(item.severity)) {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = '确认事件'; button.dataset.ackEvent = item.id; row.append(button);
        }
        return row;
    }) : [Object.assign(document.createElement('p'), {className: 'muted', textContent: '暂无安全事件'})]));
}

async function loadAdmins() {
    const data = await request('/v1/admin/security/admins');
    admins = data.items || [];
    const select = document.querySelector('#reset-admin');
    select.replaceChildren(...admins.filter(admin => admin.mfa_enabled_at && Number(admin.id) !== Number(status.admin_id)).map(admin => {
        const option = document.createElement('option'); option.value = admin.id; option.textContent = `${admin.username} · ${admin.role}`; return option;
    }));
}

document.querySelector('#setup-form').addEventListener('submit', async event => {
    event.preventDefault(); message.textContent = '正在创建双因素密钥…';
    try {
        const data = await request('/v1/admin/security/mfa/setup', {method: 'POST', body: JSON.stringify({password: document.querySelector('#setup-password').value})});
        document.querySelector('#mfa-secret').textContent = data.secret;
        const target = document.querySelector('#mfa-qr'); target.replaceChildren();
        if (typeof qrcode === 'function') {
            const qr = qrcode(0, 'M'); qr.addData(data.otpauth_uri); qr.make(); target.innerHTML = qr.createSvgTag(4, 2);
        } else target.textContent = '二维码组件不可用，请手动输入密钥。';
        document.querySelector('#enrollment-panel').hidden = false;
        message.textContent = '扫描后输入验证器显示的 6 位验证码。';
    } catch (error) { message.textContent = error.message; }
});

document.querySelector('#confirm-mfa-form').addEventListener('submit', async event => {
    event.preventDefault(); message.textContent = '正在确认动态验证码…';
    try {
        const data = await request('/v1/admin/security/mfa/confirm', {method: 'POST', body: JSON.stringify({code: document.querySelector('#confirm-mfa-code').value})});
        showRecoveryCodes(data.recovery_codes); sessionStorage.removeItem('roleai_admin_mfa_setup_required');
        status = await request('/v1/admin/security'); renderStatus(); message.textContent = '双因素认证已启用，并已完成本次敏感操作验证。';
    } catch (error) { message.textContent = error.message; }
});

document.querySelector('#step-up-form').addEventListener('submit', async event => {
    event.preventDefault(); message.textContent = '正在验证身份…';
    try {
        await request('/v1/admin/security/step-up', {method: 'POST', body: JSON.stringify({password: document.querySelector('#step-up-password').value, code: document.querySelector('#step-up-code').value})});
        document.querySelector('#step-up-form').reset(); status = await request('/v1/admin/security'); renderStatus(); message.textContent = '验证成功，10 分钟内可执行敏感操作。';
    } catch (error) { message.textContent = error.message; }
});

document.querySelector('#regenerate-codes').addEventListener('click', async () => {
    message.textContent = '正在生成新的恢复码…';
    try { const data = await request('/v1/admin/security/recovery-codes', {method: 'POST', body: '{}'}); showRecoveryCodes(data.recovery_codes); status = await request('/v1/admin/security'); renderStatus(); message.textContent = '旧恢复码已全部失效。'; }
    catch (error) { message.textContent = error.message; }
});

document.querySelector('#copy-recovery').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.querySelector('#recovery-codes').textContent); message.textContent = '恢复码已复制，请保存到安全的离线位置。'; }
    catch { message.textContent = '无法自动复制，请手动选择并保存恢复码。'; }
});

document.querySelector('#owner-reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const target = admins.find(admin => String(admin.id) === document.querySelector('#reset-admin').value);
    if (!target || document.querySelector('#reset-confirmation').value !== target.username) { message.textContent = '目标用户名确认不一致。'; return; }
    message.textContent = '正在撤销目标会话并重置 MFA…';
    try {
        await request(`/v1/admin/security/admins/${target.id}/reset-mfa`, {method: 'POST', body: '{}'});
        document.querySelector('#owner-reset-form').reset(); await loadAdmins(); message.textContent = '目标管理员 MFA 已重置，会话已全部撤销。';
    } catch (error) { message.textContent = error.message; }
});

document.querySelector('#refresh-events').addEventListener('click', () => loadSecurityEvents().catch(error => { message.textContent = error.message; }));
document.querySelector('#security-events').addEventListener('click', async event => {
    const button = event.target.closest('[data-ack-event]'); if (!button) return;
    button.disabled = true; message.textContent = '正在确认安全事件…';
    try { await request(`/v1/admin/security/events/${button.dataset.ackEvent}/acknowledge`, {method: 'POST', body: '{}'}); await loadSecurityEvents(); message.textContent = '安全事件已确认。'; }
    catch (error) { message.textContent = error.message; button.disabled = false; }
});

loadStatus().catch(error => { message.textContent = error.message || '安全状态加载失败'; });
