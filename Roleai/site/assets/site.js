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

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function skeletonCard(kind = 'card') {
    const card = element('article', `skeleton-card skeleton-${kind}`);
    card.setAttribute('aria-hidden', 'true');
    card.append(element('span', 'skeleton-block skeleton-kicker'), element('span', 'skeleton-block skeleton-heading'), element('span', 'skeleton-block skeleton-copy'), element('span', 'skeleton-block skeleton-copy skeleton-short'));
    if (kind === 'plan') card.append(element('span', 'skeleton-block skeleton-price'), element('span', 'skeleton-block skeleton-action'));
    return card;
}

function setCardSkeleton(target, kind, count) {
    if (!target) return;
    target.classList.add('is-loading');
    target.setAttribute('aria-busy', 'true');
    target.replaceChildren(...Array.from({length: count}, () => skeletonCard(kind)));
}

function clearCardSkeleton(target) {
    if (!target) return;
    target.classList.remove('is-loading');
    target.removeAttribute('aria-busy');
}

function initializeStudioStage() {
    const stage = document.querySelector('.studio-stage');
    const studio = stage?.querySelector('.studio-photo');
    const screen = stage?.querySelector('.screen-overlay[data-src]');
    if (!stage || !studio || !screen) return;
    let screenRequested = false;
    const requestScreen = () => {
        if (screenRequested) return;
        screenRequested = true;
        screen.addEventListener('load', () => stage.classList.add('screen-ready'), {once: true});
        screen.src = screen.dataset.src;
        screen.removeAttribute('data-src');
        if (screen.complete && screen.naturalWidth) stage.classList.add('screen-ready');
    };
    const studioReady = () => { stage.classList.add('studio-ready'); stage.classList.remove('is-loading'); requestScreen(); };
    studio.addEventListener('load', studioReady, {once: true});
    studio.addEventListener('error', () => { stage.classList.remove('is-loading'); requestScreen(); }, {once: true});
    if (studio.complete && studio.naturalWidth) studioReady();
}

function setReleaseSkeleton(target) {
    if (!target) return;
    target.classList.add('is-loading');
    target.setAttribute('aria-busy', 'true');
    target.replaceChildren(...Array.from({length: 3}, () => {
        const entry = element('article', 'release-timeline-item release-skeleton');
        const marker = element('span', 'release-timeline-marker');
        const card = element('div', 'release-card');
        card.setAttribute('aria-hidden', 'true');
        card.append(element('span', 'skeleton-line skeleton-date'), element('span', 'skeleton-line skeleton-title'), element('span', 'skeleton-line skeleton-meta'), element('span', 'skeleton-line skeleton-copy'), element('span', 'skeleton-line skeleton-copy short'));
        entry.append(marker, card); return entry;
    }));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('zh-CN', {style: 'currency', currency: 'CNY', maximumFractionDigits: 0}).format(Number(amount || 0) / 100);
}

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '大小待公布';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function cardMeta(values) {
    const meta = element('div', 'card-meta');
    values.filter(Boolean).forEach(value => meta.append(element('span', 'pill', value)));
    return meta;
}

function releaseState(title, message, retry = false) {
    const state = element('div', 'release-state');
    state.append(element('strong', '', title), element('p', '', message));
    if (retry) {
        const button = element('button', 'secondary', '重新加载');
        button.type = 'button';
        button.addEventListener('click', () => { button.disabled = true; button.textContent = '正在重新加载…'; loadReleases(); });
        state.append(button);
    }
    return state;
}

async function loadReleases() {
    const target = document.querySelector('#release-list');
    if (!target) return;
    target.classList.remove('is-error'); setReleaseSkeleton(target);
    try {
        const historyMode = target.dataset.history === 'true';
        let items = [];
        if (historyMode) {
            let page = 1;
            let total = 0;
            do {
                const response = await api(`/v1/release-notes?page=${page}&page_size=100`, {headers: {Accept: 'application/json'}});
                const body = await response.json();
                if (!response.ok) throw Error(body.error?.message || '更新记录加载失败');
                const pageItems = body.data?.items || [];
                items.push(...pageItems);
                total = Number(body.data?.pagination?.total || pageItems.length);
                page += 1;
            } while (items.length < total && page <= 20);
            const releasesByVersion = new Map();
            items.forEach(item => {
                const existing = releasesByVersion.get(item.version);
                if (existing) {
                    if (!existing.platforms.includes(item.platform)) existing.platforms.push(item.platform);
                    return;
                }
                releasesByVersion.set(item.version, {...item, platforms: [item.platform]});
            });
            items = [...releasesByVersion.values()];
        } else {
            const response = await api('/v1/releases', {headers: {Accept: 'application/json'}});
            const body = await response.json();
            if (!response.ok) throw Error(body.error?.message || '更新记录加载失败');
            items = body.data?.items || [];
        }
        const limit = Number(target.dataset.limit || 0);
        if (limit) items = items.slice(0, limit);
        target.classList.remove('is-loading'); target.removeAttribute('aria-busy');
        if (!items.length) { target.replaceChildren(releaseState('暂无更新记录', '公开版本发布后，会在这里按时间顺序展示。')); return; }
        if (historyMode) {
            target.replaceChildren(...items.map((item, index) => {
                const entry = element('article', 'release-timeline-item');
                const marker = element('span', 'release-timeline-marker');
                marker.setAttribute('aria-hidden', 'true');
                const card = element('div', 'release-card');
                const date = element('time', 'release-date', item.published_at?.slice(0, 10) || '日期待公布');
                if (item.published_at) date.dateTime = item.published_at.replace(' ', 'T');
                const heading = element('div', 'release-heading');
                heading.append(element('h2', '', `RoleAI Studio ${item.version}`));
                if (index === 0) heading.append(element('span', 'release-current', '当前版本'));
                const platforms = item.platforms.map(platform => ({
                    'windows-x64': 'Windows x64',
                    'macos-universal2': 'macOS Universal 2',
                }[platform] || platform));
                const channel = item.channel === 'stable' ? '正式版' : '测试版';
                const notes = element('p', 'release-notes', item.release_notes || '本次更新内容将在发布后补充。');
                card.append(date, heading, cardMeta([channel, ...platforms]), notes);
                entry.append(marker, card);
                return entry;
            }));
            return;
        }
        target.replaceChildren(...items.map(item => {
            const card = element('article', 'release-card');
            card.append(cardMeta([item.channel || 'stable', item.platform, item.published_at?.slice(0, 10)]));
            card.append(element('h3', '', `RoleAI Studio ${item.version}`));
            card.append(element('p', '', item.release_notes || '本次更新内容将在发布后补充。'));
            const status = element('span', 'card-link', item.installer_available ? '安装包可直接下载' : '查看发布说明');
            card.append(status);
            return card;
        }));
    } catch (error) {
        target.classList.remove('is-loading'); target.classList.add('is-error'); target.removeAttribute('aria-busy');
        target.replaceChildren(releaseState('更新日志暂时无法加载', error.message || '请检查网络连接后重试。', true));
    }
}

async function loadResources() {
    const target = document.querySelector('#resource-list');
    if (!target) return;
    setCardSkeleton(target, 'resource', 3);
    try {
        const response = await api('/v1/resources', {headers: {Accept: 'application/json'}});
        const body = await response.json();
        if (!response.ok) throw Error(body.error?.message || '下载资源加载失败');
        const items = body.data?.items || [];
        clearCardSkeleton(target);
        if (!items.length) { target.replaceChildren(element('div', 'empty-state', '暂无已发布下载资源。')); return; }
        target.replaceChildren(...items.map(item => {
            const card = element('article', 'resource-card');
            card.append(cardMeta([item.type, `v${item.version}`, formatBytes(item.size_bytes)]));
            card.append(element('h3', '', item.name || item.slug));
            card.append(element('p', '', item.minimum_app_version ? `需要 RoleAI Studio ${item.minimum_app_version} 或更高版本。` : '适用于当前受支持版本。'));
            card.append(element('span', 'card-link', '请在 RoleAI Studio 的“插件管理”中安装'));
            return card;
        }));
    } catch (error) {
        clearCardSkeleton(target); target.replaceChildren(element('div', 'empty-state', error.message || '暂时无法加载，请稍后重试。'));
    }
}

function macosComingSoonCard() {
    const card = element('article', 'resource-card');
    card.dataset.platformComingSoon = '';
    card.append(cardMeta(['macOS', '开发中']));
    card.append(element('h3', '', 'macOS 版即将上线'));
    card.append(element('p', '', '我们正在完成 macOS 平台适配与发布验证，暂不提供安装包下载。'));
    card.append(element('span', 'card-link', '敬请期待'));
    return card;
}

async function loadInstallers() {
    const target = document.querySelector('#installer-list');
    const homeButtons = [...document.querySelectorAll('[data-home-installer]')];
    if (!target && !homeButtons.length) return;
    if (target) setCardSkeleton(target, 'resource', 2);
    try {
        const response = await api('/v1/releases', {headers: {Accept: 'application/json'}});
        const body = await response.json();
        if (!response.ok) throw Error(body.error?.message || '安装包加载失败');
        const items = (body.data?.items || []).filter(item => item.installer_available);
        const platforms = [
            {id: 'windows-x64', button: 'Windows 版', display: 'Windows x64'},
        ];
        const currentByPlatform = new Map();
        items.forEach(item => {
            if (platforms.some(platform => platform.id === item.platform)
                && !currentByPlatform.has(item.platform)) currentByPlatform.set(item.platform, item);
        });
        if (target) clearCardSkeleton(target);
        if (!currentByPlatform.size) {
            if (target) target.replaceChildren(element('div', 'empty-state', 'Windows 版当前暂不可用。'), macosComingSoonCard());
            homeButtons.forEach(button => { button.disabled = true; button.textContent = '对应平台暂不可用'; });
            return;
        }
        homeButtons.forEach(button => {
            const platform = platforms.find(candidate => candidate.id === button.dataset.homePlatform);
            const current = platform && currentByPlatform.get(platform.id);
            if (!current) {
                button.disabled = true;
                button.textContent = `${platform?.button || '对应平台'}暂不可用`;
                return;
            }
            button.disabled = false;
            button.textContent = `下载 ${platform.button}`;
            button.dataset.installerVersion = current.version;
            button.dataset.installerPlatform = current.platform;
            button.dataset.defaultLabel = `下载 ${platform.button}`;
        });
        document.querySelectorAll('[data-current-version]').forEach(node => {
            node.textContent = platforms
                .filter(platform => currentByPlatform.has(platform.id))
                .map(platform => `${currentByPlatform.get(platform.id).version} Beta · ${platform.display}`)
                .join(' · ');
        });
        if (!target) return;
        const currentInstallers = platforms
            .map(platform => ({platform, item: currentByPlatform.get(platform.id)}))
            .filter(entry => entry.item);
        target.replaceChildren(...currentInstallers.map(({platform, item}) => {
            const card = element('article', 'resource-card');
            card.append(cardMeta([platform.display, `v${item.version}`, formatBytes(item.full_package_size)]));
            card.append(element('h3', '', `RoleAI Studio ${item.version}`));
            card.append(element('p', '', `适用于 ${platform.display}。点击后直接开始下载，安装不需要登录账户。`));
            const button = element('button', 'primary full-width', `下载 ${platform.button}`);
            button.type = 'button';
            button.dataset.installerVersion = item.version;
            button.dataset.installerPlatform = item.platform;
            button.dataset.defaultLabel = `下载 ${platform.button}`;
            card.append(button);
            return card;
        }), macosComingSoonCard());
    } catch (error) {
        if (target) { clearCardSkeleton(target); target.replaceChildren(element('div', 'empty-state', error.message || 'Windows 版暂时无法加载，请稍后重试。'), macosComingSoonCard()); }
        homeButtons.forEach(button => {
            button.disabled = true;
            const platform = button.dataset.homePlatform === 'macos-universal2' ? 'macOS 版' : 'Windows 版';
            button.textContent = `${platform}暂不可用`;
        });
    }
}

const periodLabels = {month: '/ 月', year: '/ 年', lifetime: '一次购买', free: '长期可用'};
async function loadPlans() {
    const target = document.querySelector('#plan-list');
    if (!target) return;
    setCardSkeleton(target, 'plan', 4);
    try {
        const response = await api('/v1/product', {headers: {Accept: 'application/json'}});
        const body = await response.json();
        if (!response.ok) throw Error(body.error?.message || '授权方案加载失败');
        const plans = body.data?.license_plans || [];
        clearCardSkeleton(target);
        if (!plans.length) { target.replaceChildren(element('div', 'empty-state', '当前暂无可购买的授权方案。')); return; }
        target.replaceChildren(...plans.map(plan => {
            const card = element('article', `plan-card${plan.early_bird ? ' featured' : ''}`);
            if (plan.badge) card.append(element('span', 'plan-badge', plan.badge));
            card.append(element('h3', '', plan.name));
            const price = element('div', 'plan-price', plan.purchasable === false ? '免费' : formatMoney(plan.amount));
            price.append(element('small', '', ` ${periodLabels[plan.billing_period] || ''}`));
            card.append(price, element('p', '', plan.summary || '完整使用 RoleAI Studio 创作功能。'));
            const benefits = element('ul', 'benefit-list');
            (plan.benefits || []).forEach(benefit => benefits.append(element('li', '', benefit)));
            card.append(benefits);
            if ((plan.limitations || []).length) {
                const limitations = element('ul', 'benefit-list plan-limitations');
                plan.limitations.forEach(item => limitations.append(element('li', '', item)));
                card.append(limitations);
            }
            const actions = element('div', 'plan-actions');
            if (plan.purchasable === false) {
                actions.append(element('span', 'button is-disabled full-width', '当前账户默认可用'));
                card.append(actions);
                return card;
            }
            const alipay = element('button', 'primary', '支付宝');
            alipay.dataset.buy = plan.id; alipay.dataset.way = 'ALI_QR';
            const wechat = element('button', 'secondary', '微信支付');
            wechat.dataset.buy = plan.id; wechat.dataset.way = 'WX_LITE_H5';
            actions.append(alipay, wechat); card.append(actions);
            return card;
        }));
    } catch (error) {
        clearCardSkeleton(target); target.replaceChildren(element('div', 'empty-state', error.message || '暂时无法加载，请稍后重试。'));
    }
}

const loginButton = document.querySelector('#login-button');
const purchaseMessage = document.querySelector('#purchase-message');
let currentUser = null;

function showSignedIn(user) {
    currentUser = user;
    if (loginButton) { loginButton.textContent = '账户'; loginButton.href = '/login.html'; }
    document.querySelectorAll('[data-account-support]').forEach(link => { link.hidden = false; });
    loadResources(); loadInstallers();
}
function showSignedOut() {
    currentUser = null;
    if (loginButton) { loginButton.textContent = '登录'; loginButton.href = '/login.html'; }
    document.querySelectorAll('[data-account-support]').forEach(link => { link.hidden = true; });
    loadResources(); loadInstallers();
}
async function refreshSession() {
    try {
        const response = await api('/v1/web/session', {headers: {Accept: 'application/json'}});
        const body = await response.json(); if (!response.ok) throw Error();
        showSignedIn(body.data.user);
    } catch { showSignedOut(); }
}

document.addEventListener('click', async event => {
    const download = event.target.closest('[data-resource]');
    if (download) track('download', {resource: download.dataset.resource, version: download.dataset.version || ''});
    const installer = event.target.closest('[data-installer-version]');
    if (installer) {
        const status = installer.closest('.hero-copy, .resource-card, .cta-band')?.querySelector('[data-download-status]')
            || document.querySelector('[data-download-status]');
        installer.disabled = true; installer.textContent = '正在准备下载…';
        try {
            const version = encodeURIComponent(installer.dataset.installerVersion);
            const platform = encodeURIComponent(installer.dataset.installerPlatform);
            const response = await api(`/v1/releases/${version}/${platform}/download`, {method: 'POST', headers: {'X-RoleAI-CSRF': '1'}});
            const body = await response.json();
            if (!response.ok) throw Error(body.error?.message || '安装包下载失败');
            const url = new URL(body.data?.download_url || '');
            if (url.protocol !== 'https:' || url.username || url.password) throw Error('下载暂时无法开始');
            track('download', {resource: 'desktop-installer', version: installer.dataset.installerVersion});
            location.assign(url.href);
        } catch (error) {
            installer.disabled = false; installer.textContent = installer.dataset.defaultLabel || '重新尝试下载';
            if (status) status.textContent = error.message || '下载暂时无法开始，请稍后重试。';
        }
    }
    const buy = event.target.closest('[data-buy]');
    if (!buy) return;
    if (!currentUser) { location.href = '/login.html?next=' + encodeURIComponent('/pricing.html'); return; }
    const buttons = [...document.querySelectorAll('[data-buy]')]; buttons.forEach(button => { button.disabled = true; });
    if (purchaseMessage) purchaseMessage.textContent = '正在创建安全支付订单…';
    try {
        const response = await api('/v1/payments/order', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-RoleAI-CSRF': '1'}, body: JSON.stringify({plan_id: buy.dataset.buy, way_code: buy.dataset.way})});
        const body = await response.json(); if (!response.ok) throw Error(body.error?.message || '创建订单失败');
        const orderNo = body.data?.order?.merchant_order_no; if (!orderNo) throw Error('订单信息不完整');
        location.href = '/payment.html?order=' + encodeURIComponent(orderNo);
    } catch (error) {
        if (purchaseMessage) purchaseMessage.textContent = error.message || '创建订单失败，请稍后重试。';
        buttons.forEach(button => { button.disabled = false; });
    }
});

document.querySelector('.nav-toggle')?.addEventListener('click', event => {
    const navigation = document.querySelector('#site-nav');
    const open = navigation?.classList.toggle('open') || false;
    event.currentTarget.setAttribute('aria-expanded', String(open));
});
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), {threshold: .12}) : null;
document.querySelectorAll('[data-reveal]').forEach(node => observer ? observer.observe(node) : node.classList.add('is-visible'));

initializeStudioStage();
loadReleases();
loadResources();
loadInstallers();
loadPlans();
refreshSession();
