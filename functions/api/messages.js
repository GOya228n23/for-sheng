export async function onRequest(context) {
  const { request, env } = context;
  const GH_TOKEN = env.GITHUB_TOKEN;
  const GH_RAW = 'https://raw.githubusercontent.com/GOya228n23/for-sheng/main/data/messages.json';
  const GH_API = 'https://api.github.com/repos/GOya228n23/for-sheng/contents/data/messages.json';

  const ghHeaders = GH_TOKEN ? {
    'Authorization': `token ${GH_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'sheng-site'
  } : null;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // GET: read from raw GitHub (no encoding issues)
  if (request.method === 'GET') {
    try {
      const resp = await fetch(GH_RAW, { cf: { cacheTtl: 0 } });
      const text = await resp.text();
      const messages = JSON.parse(text.trim() || '[]');
      return new Response(JSON.stringify(messages), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST: write via GitHub API
  if (request.method === 'POST') {
    if (!GH_TOKEN) {
      return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const { name, message } = body;
      if (!message || !message.trim()) {
        return new Response(JSON.stringify({ error: '消息不能为空' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      let retries = 3;
      while (retries > 0) {
        const getResp = await fetch(GH_API, { headers: ghHeaders });
        const fileData = await getResp.json();
        if (!fileData.content) {
          retries--;
          continue;
        }

        const decoded = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
        const current = JSON.parse(decoded.trim() || '[]');
        current.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          name: (name || '✨').trim().substring(0, 20),
          message: message.trim().substring(0, 500),
          time: new Date().toISOString()
        });

        const putHeaders = { ...ghHeaders, 'Content-Type': 'application/json' };
        const updateResp = await fetch(GH_API, {
          method: 'PUT',
          headers: putHeaders,
          body: JSON.stringify({
            message: `💬 guestbook message`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(current)))),
            sha: fileData.sha
          })
        });

        if (updateResp.status === 422) { retries--; continue; }
        if (updateResp.ok) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...cors, 'Content-Type': 'application/json' }
          });
        }
        retries--;
      }
      return new Response(JSON.stringify({ error: '提交失败，请重试' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: cors });
}
