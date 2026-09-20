(() => {
  const endpoint = 'https://tjxjxavxrmvbofvtnsaj.supabase.co/functions/v1/buytest-analytics';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqeGp4YXZ4cm12Ym9mdnRuc2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjk3NjMsImV4cCI6MjEwMzkwNTc2M30.AWPEga4E1CQQ9QqqMyw1gTJn__aqV_fCx_raQhGjMck';
  const visitorKey = 'buytestAnalyticsVisitorV1';
  const sessionKey = 'buytestAnalyticsSessionV1';
  const attributionKey = 'buytestTrafficAttributionV1';
  const sessionMs = 30 * 60 * 1000;
  const attributionMs = 30 * 24 * 60 * 60 * 1000;

  function id() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'bt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }
  function identity() {
    let visitorId = '';
    try { visitorId = localStorage.getItem(visitorKey) || ''; } catch (_) {}
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(visitorId)) {
      visitorId = id();
      try { localStorage.setItem(visitorKey, visitorId); } catch (_) {}
    }
    let session = { id: '', lastAt: 0 };
    try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null') || session; } catch (_) {}
    const now = Date.now();
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(String(session.id || '')) || now - Number(session.lastAt || 0) > sessionMs) session = { id: id(), lastAt: now };
    else session.lastAt = now;
    try { localStorage.setItem(sessionKey, JSON.stringify(session)); } catch (_) {}
    return { visitorId, sessionId: session.id };
  }
  function clean(value, max = 120) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function attribution() {
    const params = new URLSearchParams(location.search);
    const utmSource = clean(params.get('utm_source'), 80).toLowerCase();
    const utmMedium = clean(params.get('utm_medium'), 80).toLowerCase();
    const utmCampaign = clean(params.get('utm_campaign'), 120);
    const google = params.has('gclid') || ['google', 'googleads', 'adwords'].includes(utmSource);
    const meta = params.has('fbclid') || ['facebook', 'instagram', 'meta', 'fb', 'ig'].includes(utmSource);
    const tiktok = params.has('ttclid') || ['tiktok', 'tiktokads', 'tiktok_ads', 'tt'].includes(utmSource);
    if (google || meta || tiktok || utmSource || utmMedium || utmCampaign) {
      const value = { trafficSource: google ? 'google' : meta ? 'meta' : tiktok ? 'tiktok' : 'other', utmSource, utmMedium, utmCampaign, capturedAt: Date.now() };
      try { localStorage.setItem(attributionKey, JSON.stringify(value)); } catch (_) {}
      return value;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(attributionKey) || 'null');
      if (saved && Date.now() - Number(saved.capturedAt || 0) < attributionMs) return saved;
    } catch (_) {}
    let host = '';
    try { host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch (_) {}
    if (/google\./.test(host)) return { trafficSource: 'google', utmSource: host, utmMedium: 'organic', utmCampaign: '' };
    if (/facebook\.|instagram\./.test(host)) return { trafficSource: 'meta', utmSource: host, utmMedium: 'social', utmCampaign: '' };
    if (/tiktok\./.test(host)) return { trafficSource: 'tiktok', utmSource: host, utmMedium: 'social', utmCampaign: '' };
    return { trafficSource: host && host !== location.hostname.toLowerCase() ? 'other' : 'direct', utmSource: host, utmMedium: host ? 'referral' : '', utmCampaign: '' };
  }
  async function track(eventType) {
    const body = { action: 'track', eventType, pagePath: location.pathname, pageTitle: document.title, ...identity(), ...attribution() };
    try {
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: JSON.stringify(body), keepalive: true });
    } catch (_) {}
  }
  track('blog_view');
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && !url.pathname.startsWith('/articles/')) track('blog_to_site');
  }, true);
})();
