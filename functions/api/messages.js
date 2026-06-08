export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const GH_TOKEN = env.GITHUB_TOKEN;
  const GH_API = 'https://api.github.com/repos/GOya228n23/for-sheng/contents/data/messages.json';
  const headers = {
    'Authorization': `token ${GH_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'sheng-site-guestbook'
  };

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET: fetch messages
  if (request.method === 'GET') {
    try {
      const resp = await fetch(GH_API, { headers });
      const data = await resp.json();
      const messages = JSON.parse(atob(data.content));
      return new Response(JSON.stringify(messages), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // POST: add message (with retry for race conditions)
  if (request.method === 'POST') {
    const body = await request.json();
    const { name, message } = body;
    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: '消息不能为空' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let retries = 3;
    while (retries > 0) {
      try {
        // Get current messages
        const getResp = await fetch(GH_API, { headers });
        const fileData = await getResp.json();
        const messages = JSON.parse(atob(fileData.content));

        // Add new message
        messages.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          name: (name || '✨').trim().substring(0, 20),
          message: message.trim().substring(0, 500),
          time: new Date().toISOString()
        });

        // Update file
        const updateHeaders = {
          ...headers,
          'Content-Type': 'application/json'
        };
        const updateResp = await fetch(GH_API, {
          method: 'PUT',
          headers: updateHeaders,
          body: JSON.stringify({
            message: `💬 ${(name || '匿名').substring(0, 10)}: ${message.substring(0, 50)}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(messages)))),
            sha: fileData.sha
          })
        });

        if (updateResp.status === 422) {
          // SHA conflict, retry
          retries--;
          continue;
        }

        const result = await updateResp.json();
        if (result.content) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        retries--;
      } catch (e) {
        retries--;
        if (retries === 0) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }
    return new Response(JSON.stringify({ error: '提交失败，请重试' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}
