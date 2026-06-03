// EdgeOne Function: AI connection test
export default async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { ai_api_key, ai_base_url, ai_model } = await context.request.json();

    const url = `${ai_base_url.replace(/\/$/, '')}/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ai_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ai_model,
        messages: [
          { role: 'system', content: '只回复单词 OK，不要回复任何其他内容。' },
          { role: 'user', content: 'hi' },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ success: false, message: `API 错误: ${resp.status} ${errText.slice(0, 100)}` }), { headers: { 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const msg = (data?.choices?.[0]?.message) || {};
    const reply = msg?.content || msg?.reasoning_content || data?.choices?.[0]?.text || '';

    return new Response(JSON.stringify({
      success: true,
      message: reply ? `连接成功！模型回复: ${reply.slice(0, 50)}` : '连接成功！API 响应正常',
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: `连接失败: ${e.message.slice(0, 100)}` }), { headers: { 'Content-Type': 'application/json' } });
  }
}
