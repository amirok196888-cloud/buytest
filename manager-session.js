/* Store only a revocable server session on this device, never the manager PIN. */
(() => {
  const KEY = 'buytestManagerSessionV1';
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (typeof value?.token === 'string' && /^BTADM-[0-9a-f]{64}$/.test(value.token)
        && new Date(value.expiresAt).getTime() > Date.now()) return value;
    } catch (_) {}
    localStorage.removeItem(KEY);
    return null;
  };

  const originalAnalytics = callBuyTestAnalyticsService;
  callBuyTestAnalyticsService = async function (body, options) {
    const result = await originalAnalytics(body, options);
    if (body?.action === 'admin_auth' && /^BTADM-[0-9a-f]{64}$/.test(result.sessionToken || '')) {
      localStorage.setItem(KEY, JSON.stringify({token: result.sessionToken, expiresAt: result.expiresAt}));
      buyTestManagerPin = result.sessionToken;
    }
    return result;
  };

  const managerHub = document.getElementById('managerHub');
  if (managerHub && !document.getElementById('managerDeviceSignOut')) {
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.id = 'managerDeviceSignOut';
    logout.className = 'secondary';
    logout.textContent = 'התנתקות מהמנהל במכשיר הזה';
    logout.style.cssText = 'display:none;margin:12px auto;max-width:340px';
    managerHub.appendChild(logout);
    const showLogout = new MutationObserver(() => {
      logout.style.display = document.body.classList.contains('manager-mode') ? 'block' : 'none';
    });
    showLogout.observe(document.body, {attributes:true, attributeFilter:['class']});
    logout.addEventListener('click', async () => {
      try { await callBuyTestAnalyticsService({action:'admin_logout'}, {manager:true}); } catch (_) {}
      localStorage.removeItem(KEY);
      buyTestManagerPin = '';
      location.href = '/';
    });
  }

  const saved = read();
  if (saved && new URLSearchParams(location.search).has('manager')) {
    void openManagerPreview(saved.token).then(() => {
      if (!document.body.classList.contains('manager-mode')) localStorage.removeItem(KEY);
    }).catch(() => localStorage.removeItem(KEY));
  }
})();
