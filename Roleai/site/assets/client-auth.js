const API = window.ROLEAI_API_BASE || 'https://api.roleai.studio';
const message = document.querySelector('#auth-message');
const help = document.querySelector('#launch-help');
const account = document.querySelector('#auth-account');
const phone = document.querySelector('#auth-phone');
const authorize = document.querySelector('#authorize-client');
const query = new URLSearchParams(location.search);
const callbackPort = String(query.get('callback_port') || '');
const callbackState = String(query.get('state') || '');
const codeChallenge = String(query.get('code_challenge') || '');
const hasLoopbackCallback = /^\d{1,5}$/.test(callbackPort)
    && Number(callbackPort) >= 1 && Number(callbackPort) <= 65535
    && /^[a-f0-9]{32}$/.test(callbackState)
    && /^[a-f0-9]{64}$/.test(codeChallenge);

const maskedPhone = value => value ? value.slice(0, 3) + '****' + value.slice(-4) : '';

function loginRedirectUrl() {
    const next = new URLSearchParams({desktop_auth: '1'});
    if (hasLoopbackCallback) {
        next.set('callback_port', callbackPort);
        next.set('state', callbackState);
        next.set('code_challenge', codeChallenge);
    }
    return '/login.html?' + next.toString();
}

async function loadSession() {
    try {
        const response = await fetch(API + '/v1/web/session', {
            credentials: 'include', headers: {Accept: 'application/json'}
        });
        const body = await response.json();
        if (!response.ok) throw Error();
        phone.textContent = maskedPhone(String(body.data.user.phone || ''));
        account.hidden = false;
        authorize.disabled = false;
        message.textContent = hasLoopbackCallback
            ? 'RoleAI Studio 正在请求使用此账户登录。请确认这是你本人发起的操作。'
            : '浏览器已经登录。请返回 RoleAI Studio，再次点击登录账户。';
        authorize.textContent = hasLoopbackCallback
            ? '允许登录 RoleAI Studio'
            : '打开 RoleAI Studio 继续登录';
    } catch {
        location.replace(loginRedirectUrl());
    }
}

function launchDesktopAuthorization() {
    authorize.disabled = true;
    authorize.textContent = '正在打开 RoleAI Studio…';
    message.textContent = '软件打开后会继续登录流程。';
    location.href = 'roleai-studio://authorize';
    setTimeout(() => {
        authorize.disabled = false;
        authorize.textContent = '重新打开 RoleAI Studio';
        help.textContent = '如果软件没有打开，请安装包含浏览器登录支持的新版 RoleAI Studio 后重试。';
    }, 1800);
}

authorize.onclick = async () => {
    if (!hasLoopbackCallback) {
        launchDesktopAuthorization();
        return;
    }

    authorize.disabled = true;
    message.textContent = '正在确认登录…';
    try {
        const response = await fetch(API + '/v1/web/client-authorize', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-RoleAI-CSRF': '1',
                Accept: 'application/json'
            },
            body: JSON.stringify({code_challenge: codeChallenge})
        });
        const body = await response.json();
        const ticket = String(body.data?.login_ticket || '');
        if (!response.ok || !/^[a-f0-9]{64}$/.test(ticket)) {
            throw Error(body.error?.message || '授权失败');
        }
        message.textContent = '登录已确认，正在返回 RoleAI Studio…';
        location.replace('http://127.0.0.1:' + callbackPort
            + '/roleai-auth?ticket=' + encodeURIComponent(ticket)
            + '&state=' + encodeURIComponent(callbackState));
    } catch (error) {
        authorize.disabled = false;
        message.textContent = error.message || '授权失败，请重新登录后再试。';
    }
};

loadSession();
