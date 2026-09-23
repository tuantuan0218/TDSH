const API = window.ROLEAI_API_BASE || 'https://api.roleai.studio';
const message = document.querySelector('#identity-message');
const account = document.querySelector('#identity-account');
const phone = document.querySelector('#identity-phone');
const form = document.querySelector('#identity-form');
const submit = document.querySelector('#identity-submit');
const agreementCheckbox = document.querySelector('#identity-accept-agreements');
let complianceDocuments = {};
let identityAlreadyVerified = false;

const maskedPhone = value => value ? value.slice(0, 3) + '****' + value.slice(-4) : '';
const nextUrl = '/identity.html' + location.search;

async function loadSession() {
    try {
        const [sessionResponse, documentsResponse] = await Promise.all([
            fetch(API + '/v1/web/session', {
                credentials: 'include', headers: {Accept: 'application/json'}
            }),
            fetch(API + '/v1/auth/compliance/documents', {
                credentials: 'include', headers: {Accept: 'application/json'}
            })
        ]);
        const body = await sessionResponse.json();
        const documentsBody = await documentsResponse.json();
        if (!sessionResponse.ok || !documentsResponse.ok) throw Error();
        complianceDocuments = documentsBody.data.documents || {};
        document.querySelector('#identity-user-agreement-link').href =
            complianceDocuments.user_agreement?.url || '/legal/user-agreement.html';
        document.querySelector('#identity-privacy-policy-link').href =
            complianceDocuments.privacy_policy?.url || '/legal/privacy-policy.html';
        const user = body.data.user;
        phone.textContent = maskedPhone(String(user.phone || ''));
        account.hidden = false;
        if (user.real_name_verified) {
            identityAlreadyVerified = true;
            if (user.compliance?.all_accepted) {
                completed();
                return;
            }
            document.querySelector('#identity-title').textContent = '确认最新协议';
            document.querySelector('#identity-intro').textContent =
                '您的实名认证仍然有效，无需重新提交姓名和身份证信息。请阅读并同意当前版本的协议。';
            document.querySelector('#identity-name-field').hidden = true;
            document.querySelector('#identity-number-field').hidden = true;
            document.querySelector('#identity-privacy-note').hidden = true;
            document.querySelector('#real-name').required = false;
            document.querySelector('#identity-number').required = false;
            submit.textContent = '确认协议并返回软件';
            message.textContent = '请确认当前版本的用户协议和隐私政策。';
            return;
        }
        message.textContent = '请填写与该手机号实名登记一致的姓名和证件号码。';
    } catch {
        const query = new URLSearchParams({next: nextUrl});
        location.replace('/?' + query.toString() + '#login');
    }
}

function completed() {
    form.hidden = true;
    account.hidden = false;
    message.textContent = identityAlreadyVerified
        ? '协议已确认，AI 能力权限已恢复。可以返回 RoleAI Studio。'
        : '实名认证成功，AI 能力权限已开通。可以返回 RoleAI Studio。';
    if (new URLSearchParams(location.search).get('desktop') === '1') {
        location.href = 'roleai-studio://identity-complete';
    }
}

form.onsubmit = async event => {
    event.preventDefault();
    if (!agreementCheckbox.checked) {
        message.textContent = '请先阅读并勾选用户协议和隐私政策。';
        return;
    }
    submit.disabled = true;
    message.textContent = identityAlreadyVerified
        ? '正在记录您的协议确认…'
        : '正在通过阿里云核验手机号、姓名和证件号码…';
    try {
        const consents = {
            user_agreement: complianceDocuments.user_agreement?.version || '',
            privacy_policy: complianceDocuments.privacy_policy?.version || ''
        };
        const endpoint = identityAlreadyVerified
            ? '/v1/auth/compliance/accept'
            : '/v1/auth/identity/verify';
        const payload = identityAlreadyVerified
            ? {consents}
            : {
                real_name: document.querySelector('#real-name').value,
                identity_number: document.querySelector('#identity-number').value,
                consents
            };
        const response = await fetch(API + endpoint, {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json', 'X-RoleAI-CSRF': '1', Accept: 'application/json'},
            body: JSON.stringify(payload)
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error?.message ||
            (identityAlreadyVerified ? '协议确认失败' : '实名认证失败'));
        completed();
    } catch (error) {
        submit.disabled = false;
        message.textContent = error.message ||
            (identityAlreadyVerified ? '协议确认失败，请稍后重试。' : '实名认证失败，请稍后重试。');
    }
};

loadSession();
