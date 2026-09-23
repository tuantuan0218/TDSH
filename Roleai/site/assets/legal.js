const API = window.ROLEAI_API_BASE || 'https://api.roleai.studio';

function renderInline(text) {
    const fragment = document.createDocumentFragment();
    const parts = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)]+\))/g);
    parts.forEach(part => {
        const strong = part.match(/^\*\*([^*]+)\*\*$/);
        const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
        if (strong) { const element = document.createElement('strong'); element.textContent = strong[1]; fragment.append(element); }
        else if (link) { const element = document.createElement('a'); element.textContent = link[1]; element.href = link[2]; element.target = '_blank'; element.rel = 'noopener noreferrer'; fragment.append(element); }
        else fragment.append(document.createTextNode(part));
    });
    return fragment;
}

function renderMarkdown(markdown) {
    const root = document.createDocumentFragment();
    let list = null;
    const closeList = () => { if (list) { root.append(list); list = null; } };
    String(markdown).replace(/\r/g, '').split('\n').forEach(line => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        const item = line.match(/^[-*]\s+(.+)$/);
        if (item) {
            if (!list) list = document.createElement('ul');
            const li = document.createElement('li'); li.append(renderInline(item[1])); list.append(li); return;
        }
        closeList();
        if (!line.trim()) return;
        const element = document.createElement(heading ? (heading[1].length === 1 ? 'h2' : 'h3') : 'p');
        element.append(renderInline(heading ? heading[2] : line)); root.append(element);
    });
    closeList(); return root;
}

function enhanceLegalTables(body) {
    body.querySelectorAll('table').forEach((table, index) => {
        let wrapper = table.closest('.legal-table-wrap');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'legal-table-wrap';
            table.before(wrapper); wrapper.append(table);
        }
        table.classList.add('legal-data-table');
        if (!table.tHead) {
            const firstRow = table.rows[0];
            if (firstRow) {
                const head = table.createTHead();
                const headerRow = head.insertRow();
                [...firstRow.cells].forEach(cell => {
                    const th = document.createElement('th');
                    [...cell.attributes].forEach(attribute => th.setAttribute(attribute.name, attribute.value));
                    th.scope = 'col'; th.append(...cell.childNodes); headerRow.append(th);
                });
                firstRow.remove();
            }
        }
        table.querySelectorAll('thead th').forEach(th => { if (!th.scope) th.scope = 'col'; });
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', `文档表格 ${index + 1}，可横向滚动查看全部内容`);
    });
}

async function loadLegalDocument() {
    const article = document.querySelector('[data-document-type]');
    if (!article) return;
    const content = document.querySelector('#legal-content');
    const skeleton = document.querySelector('#legal-skeleton');
    const status = document.querySelector('#legal-status');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const finishLoading = () => {
        skeleton?.setAttribute('hidden', '');
        if (content) content.hidden = false;
        article.setAttribute('aria-busy', 'false');
        if (status) status.textContent = '法律文档已加载。';
        enhanceLegalTables(article);
    };
    try {
        const response = await fetch(`${API}/v1/compliance/documents/${article.dataset.documentType}`, {headers:{Accept:'application/json'},signal:controller.signal});
        if (!response.ok) return;
        const payload = await response.json(); const documentData = payload.data?.document;
        if (!documentData?.content_markdown && !documentData?.content_html) return;
        document.querySelector('#legal-title').textContent = documentData.title;
        const published = documentData.published_at ? new Date(`${documentData.published_at.replace(' ', 'T')}+08:00`).toLocaleDateString('zh-CN') : '';
        document.querySelector('#legal-meta').textContent = `版本：${documentData.version}${published ? `　生效日期：${published}` : ''}`;
        const body = document.querySelector('#legal-body');
        if (documentData.content_html) body.innerHTML = documentData.content_html;
        else body.replaceChildren(renderMarkdown(documentData.content_markdown));
    } catch (_) { /* 超时或失败时显示服务器部署包内的静态法律文本。 */ }
    finally { window.clearTimeout(timeout); finishLoading(); }
}

loadLegalDocument();
