// ACL Depo — Cloudflare Workers Proxy
// - Anthropic API (CORS proxy)
// - Firebase FCM push gönderimi

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Action',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const action = request.headers.get('X-Action') || 'anthropic';

    // ── ANTHROPİC API PROXY ──────────────────────────────────
    if (action === 'anthropic') {
      try {
        const body = await request.json();
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // ── FCM PUSH GÖNDERİMİ ───────────────────────────────────
    if (action === 'fcm-push') {
      try {
        const body = await request.json();
        const { tokens, title, body: msgBody, data: msgData, isAcil } = body;

        if (!tokens || !tokens.length) {
          return new Response(JSON.stringify({ error: 'Token yok' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        // FCM v1 API — her token için ayrı istek (max 500 token/istek için multicast kullanılabilir)
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;

        // Google OAuth2 token al
        const accessToken = await getGoogleAccessToken(env.FCM_SERVICE_ACCOUNT);

        const results = [];
        for (const token of tokens.slice(0, 50)) { // max 50 token
          try {
            const message = {
              message: {
                token: token,
                notification: {
                  title: title || 'ACL Depo',
                  body: msgBody || 'Yeni bildirim'
                },
                android: {
                  priority: isAcil ? 'high' : 'normal',
                  notification: {
                    sound: 'default',
                    channel_id: isAcil ? 'acl_acil' : 'acl_normal',
                    vibrate_timings_millis: isAcil ? ['300ms','100ms','300ms','100ms','500ms'] : ['200ms','100ms','200ms'],
                    notification_priority: isAcil ? 'PRIORITY_MAX' : 'PRIORITY_HIGH'
                  }
                },
                data: msgData || { oncelik: isAcil ? 'acil' : 'normal' }
              }
            };

            const res = await fetch(fcmUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(message)
            });
            results.push({ token: token.slice(-6), status: res.status });
          } catch(e) {
            results.push({ token: token.slice(-6), error: e.message });
          }
        }

        return new Response(JSON.stringify({ success: true, results }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    return new Response('Unknown action', { status: 400 });
  }
};

// Google OAuth2 access token — Service Account JWT
async function getGoogleAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64 = s => btoa(JSON.stringify(s)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const unsigned = b64(header) + '.' + b64(claim);

  // RS256 imza
  const keyData = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----','')
    .replace('-----END PRIVATE KEY-----','')
    .replace(/\s/g,'');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(keyData), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = unsigned + '.' + btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  return data.access_token;
}
