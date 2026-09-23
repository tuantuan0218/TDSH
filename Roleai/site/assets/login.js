const API = window.ROLEAI_API_BASE || 'https://api.roleai.studio';
const api = (path, options = {}) => fetch(API + path, {credentials: 'include', ...options});
let analyticsSession = localStorage.getItem('roleai_analytics_session');
if (!analyticsSession) {
    analyticsSession = crypto.randomUUID().replaceAll('-', '');
    localStorage.setItem('roleai_analytics_session', analyticsSession);
}
const track = (event, extra = {}) => fetch(API + '/v1/analytics/event', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({event, session_id: analyticsSession, ...extra}), keepalive: true
}).catch(() => {});
track('page_view');
const form = document.querySelector('#login-form');
const smsPanel = document.querySelector('#sms-login-panel');
const accountPanel = document.querySelector('#browser-account-panel');
const message = document.querySelector('#login-message');
const humanVerifyButton = document.querySelector('#human-verify');
const query = new URLSearchParams(location.search);
const desktopFlow = query.get('desktop_auth') === '1';
const nextPath = query.get('next') || '';
const desktopAuthUrl = (() => {
    const next = new URLSearchParams();
    for (const key of ['callback_port', 'state', 'code_challenge']) {
        const value = query.get(key); if (value) next.set(key, value);
    }
    return '/client-auth.html' + (next.size ? '?' + next.toString() : '');
})();
let challenge = '';
let complianceDocuments = {};
let captchaInstance = null;
let captchaChallengeId = '';
let smsCountdownTimer = 0;

const maskedPhone = phone => phone ? phone.slice(0, 3) + '****' + phone.slice(-4) : '';
const validNextPath = value => /^\/(?:pricing|payment|identity)\.html(?:\?|$)/.test(value);

function showSignedIn(user) {
    smsPanel.hidden = true;
    accountPanel.hidden = false;
    document.querySelector('#account-phone').textContent = maskedPhone(String(user.phone || ''));
    message.textContent = '账户已登录。';
}

function showSignedOut() {
    smsPanel.hidden = false;
    accountPanel.hidden = true;
}

function continueAfterLogin() {
    if (desktopFlow) { location.replace(desktopAuthUrl); return true; }
    if (validNextPath(nextPath)) { location.replace(nextPath); return true; }
    return false;
}

async function refreshSession() {
    try {
        const response = await api('/v1/web/session', {headers: {Accept: 'application/json'}});
        const body = await response.json();
        if (!response.ok) throw Error();
        if (!continueAfterLogin()) showSignedIn(body.data.user);
    } catch {
        showSignedOut();
        message.textContent = '请输入手机号登录。';
    }
}

function acceptedAgreements() { return document.querySelector('#accept-agreements').checked; }

function startSmsCountdown(seconds = 60) {
    clearInterval(smsCountdownTimer);
    let remaining = seconds;
    humanVerifyButton.disabled = true;
    humanVerifyButton.textContent = `${remaining} 秒后重试`;
    smsCountdownTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(smsCountdownTimer);
            humanVerifyButton.disabled = false;
            humanVerifyButton.textContent = '获取验证码';
        } else humanVerifyButton.textContent = `${remaining} 秒后重试`;
    }, 1000);
}

async function requestLoginSms() {
    const response = await api('/v1/auth/sms/request', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-RoleAI-CSRF': '1'},
        body: JSON.stringify({phone: document.querySelector('#phone').value, captcha_challenge_id: captchaChallengeId})
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error?.message || '短信发送失败');
    challenge = body.data.challenge_id;
    message.textContent = '验证码已发送，5 分钟内有效。';
    startSmsCountdown(60);
}

async function verifyCaptchaAndSend(captchaVerifyParam) {
    const response = await api('/v1/auth/captcha/verify', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-RoleAI-CSRF': '1'},
        body: JSON.stringify({purpose: 'login_sms', captcha_verify_param: captchaVerifyParam})
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error?.message || '人机验证失败');
    captchaChallengeId = String(body.data.captcha_challenge_id || '');
    await requestLoginSms();
}

async function initializeCompliance() {
    const response = await api('/v1/auth/compliance/documents', {headers: {Accept: 'application/json'}});
    const body = await response.json();
    if (!response.ok) throw Error(body.error?.message || '无法加载登录配置');
    complianceDocuments = body.data.documents || {};
    window.AliyunCaptchaConfig = {region: body.data.captcha.region, prefix: body.data.captcha.prefix};
    const script = document.createElement('script');
    script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
    script.onload = () => window.initAliyunCaptcha({
        SceneId: body.data.captcha.scene_id,
        mode: 'popup',
        element: '#captcha-element',
        button: '#captcha-trigger',
        language: 'cn',
        dualStack: false,
        slideStyle: {width: 360, height: 40},
        success: value => verifyCaptchaAndSend(value).catch(error => {
            humanVerifyButton.disabled = false;
            message.textContent = error.message || '验证失败，请重试。';
        }),
        fail: () => { message.textContent = '人机验证未通过，请重试。'; },
        onError: () => { humanVerifyButton.disabled = false; message.textContent = '人机验证暂时不可用，请稍后重试。'; },
        getInstance: instance => { captchaInstance = instance; humanVerifyButton.disabled = false; }
    }).catch(() => { humanVerifyButton.disabled = true; message.textContent = '人机验证暂时不可用，请稍后重试。'; });
    script.onerror = () => { message.textContent = '人机验证加载失败，请检查网络后重试。'; };
    document.head.append(script);
}

humanVerifyButton.addEventListener('click', () => {
    if (!acceptedAgreements()) { message.textContent = '请先阅读并勾选用户协议和隐私政策。'; return; }
    if (!/^1[3-9][0-9]{9}$/.test(document.querySelector('#phone').value)) { message.textContent = '请输入有效的中国大陆手机号。'; return; }
    if (!captchaInstance?.show) { message.textContent = '人机验证仍在加载，请稍后重试。'; return; }
    message.textContent = '';
    captchaInstance.show();
});

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!acceptedAgreements()) { message.textContent = '请先阅读并勾选用户协议和隐私政策。'; return; }
    if (!challenge) { message.textContent = '请先完成人机验证并获取短信验证码。'; return; }
    const response = await api('/v1/auth/sms/verify', {
        method: 'POST', headers: {'Content-Type': 'application/json', 'X-RoleAI-CSRF': '1'},
        body: JSON.stringify({
            challenge_id: challenge,
            code: document.querySelector('#code').value,
            consents: {
                user_agreement: complianceDocuments.user_agreement?.version || '',
                privacy_policy: complianceDocuments.privacy_policy?.version || ''
            }
        })
    });
    const body = await response.json();
    if (!response.ok) { message.textContent = body.error?.message || '登录失败'; return; }
    track('login_success');
    if (!continueAfterLogin()) showSignedIn(body.data.user);
});

document.querySelector('#browser-logout').addEventListener('click', async () => {
    await api('/v1/web/logout', {method: 'POST', headers: {'X-RoleAI-CSRF': '1'}}).catch(() => {});
    showSignedOut(); message.textContent = '已退出账户。';
});
document.querySelector('#desktop-authorize-link').addEventListener('click', () => { location.href = '/client-auth.html'; });

initializeCompliance().catch(error => {
    humanVerifyButton.disabled = true;
    message.textContent = error.message || '登录配置加载失败，请稍后重试。';
});
refreshSession();
