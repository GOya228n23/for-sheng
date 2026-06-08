export async function onRequest(context) {
  const { request, env } = context;
  const GH_TOKEN = env.GITHUB_TOKEN;

  // Debug: if no token, return helpful error
  if (!GH_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured', hasEnv: typeof env !== 'undefined', keys: env ? Object.keys(env).join(',') : 'no-env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const GH_API = 'https://api.github.com/repos/GOya228n23/for-sheng/contents/data/messages.json';
  const ghHeaders = {
    'Authorization': `token ${GH_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'sheng-site'
  };

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (request.method === 'GET') {
    try {
      const resp = await fetch(GH_API, { headers: ghHeaders });
      const data = await resp.json();
      if (data.content) {
        const messages = JSON.parse(atob(data.content));
        return new Response(JSON.stringify(messages), {
          headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify([]), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'POST') {
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
        if (!fileData.content) throw new Error('Failed to read messages');

        const messages = JSON.parse(atob(fileData.content));
        messages.push({
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
            message: `💬 ${(name || '匿名').substring(0, 10)}: ${message.substring(0, 50)}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(messages)))),
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
