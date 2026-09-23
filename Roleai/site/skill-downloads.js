(() => {
  'use strict';

  // Fill these two URLs after the GitHub release and official package are uploaded.
  const configured = window.ROLEAI_SKILL_DOWNLOADS || {};
  const channels = {
    github: configured.github || '',
    official: configured.official || ''
  };

  document.querySelectorAll('[data-skill-download]').forEach(link => {
    const channel = link.dataset.skillDownload;
    const url = channels[channel];
    if (!url) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      return;
    }

    link.href = url;
    link.removeAttribute('aria-disabled');
    if (channel === 'github') {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else {
      link.setAttribute('download', '');
    }
    const status = document.querySelector(`[data-skill-status="${channel}"]`);
    if (status) status.textContent = channel === 'github' ? '在 GitHub 查看版本与下载' : '从 RoleAI 官网获取正式包';
  });
})();
