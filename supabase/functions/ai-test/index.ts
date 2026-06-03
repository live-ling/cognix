// Edge Function: AI connection test
// Deploy: supabase functions deploy ai-test

import "jsr:@std/http/allow-json";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { status: 405 });
  }

  try {
    const { ai_api_key, ai_base_url, ai_model } = await req.json();
    if (!ai_api_key || !ai_base_url || !ai_model) {
      return new Response(JSON.stringify({ success: false, message: "缺少参数" }), { status: 400 });
    }

    const url = `${ai_base_url.replace(/\/$/, "")}/chat/completions`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ai_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ai_model,
        messages: [
          { role: "system", content: "只回复单词 OK，不要回复任何其他内容。" },
          { role: "user", content: "hi" },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({
        success: false,
        message: `API 错误: ${resp.status} ${errText.slice(0, 100)}`,
      }));
    }

    const data = await resp.json();
    const choices = data?.choices || [];
    const msg = choices[0]?.message || {};
    const reply = msg?.content || msg?.reasoning_content || choices[0]?.text || "";

    return new Response(JSON.stringify({
      success: true,
      message: reply ? `连接成功！模型回复: ${reply.slice(0, 50)}` : "连接成功！API 响应正常",
    }));
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      message: `连接失败: ${(e as Error).message.slice(0, 100)}`,
    }));
  }
});
