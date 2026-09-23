const API = 'https://api.roleai.studio';
const token = sessionStorage.getItem('roleai_admin_token') || '';
const endpoint = document.body.dataset.adminEndpoint;
const content = document.querySelector('#aux-content');
if (!token) location.replace('/admin/login.html');

const labels = {sms_24h: '近 24 小时短信请求', payment_failed_24h: '近 24 小时支付失败', active_sessions: '有效桌面会话', admin_failed_logins_15m: '近 15 分钟管理员登录失败', security_high_unacknowledged: '未确认高危安全事件', security_events_24h: '近 24 小时安全事件', security_alert_webhook: '安全告警 Webhook', security_alert_sms: '安全告警短信', database: '数据库', region: '服务区域', sms_sign: '短信签名', sms_template: '短信模板', payment_ways: '支付方式', oss_base: 'OSS 公共地址', static_base: '静态资源地址', secrets_configured: '服务凭据配置'};
function display(value) {
    if (Array.isArray(value)) return value.join('、');
    if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${item ? '已配置' : '未配置'}`).join(' · ');
    return String(value ?? '未配置');
}
fetch(`${API}/v1/admin/${endpoint}`, {headers: {Accept: 'application/json', Authorization: `Bearer ${token}`}})
    .then(async response => { const body = await response.json(); if (!response.ok) throw Error(body.error?.message || '加载失败'); return body.data || {}; })
    .then(data => {
        content.replaceChildren(...Object.entries(data).map(([key, value]) => {
            const card = document.createElement('article'); card.className = 'settings-item';
            const label = document.createElement('small'); label.textContent = labels[key] || key;
            const result = document.createElement('strong'); result.textContent = display(value);
            card.append(label, result); return card;
        }));
    })
    .catch(error => { content.textContent = error.message || '加载失败'; });
