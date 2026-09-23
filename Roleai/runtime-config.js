(() => {
  'use strict';
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    window.ROLEAI_API_BASE = '/api';
  }
})();

