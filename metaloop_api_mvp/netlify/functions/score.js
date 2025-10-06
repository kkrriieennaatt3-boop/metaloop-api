// netlify/functions/score.js
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}");

    const system = `
あなたは新規事業の「閉ループ診断」アナリストです。
入力（why, who, value, delivery, money, feedback, driver）を読み、5軸を各0–100で採点。
重み [0.25,0.25,0.20,0.15,0.15] で total(0–100) を算出（整数）。
出力は必ず JSON オブジェクトのみ（自然文禁止）。鍵: axes,total,advice,details。
`;

    // --- OpenAI 呼び出し ---
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `入力: ${JSON.stringify(payload)}` }
        ],
        temperature: 0.2,
        max_tokens: 1200
      })
    });

    const raw = await resp.json();

    // --- モデル出力の取り出し（Responses/Chat両対応） ---
    let txt =
      raw?.choices?.[0]?.message?.content ??
      raw?.output?.[0]?.content?.[0]?.text ??
      raw?.output_text ?? "";

    // content がオブジェクトの場合はそのまま
    let parsed = (txt && typeof txt === "object") ? txt : null;

    // content が文字列なら JSON を頑丈にパース
    if (!parsed && typeof txt === "string") {
      const sanitize = (s) => {
        // コードフェンスやスマートクォートを除去
        s = s.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
        s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        // 先頭{ 〜 最後} のみ抽出（前後に説明文が付いた場合に備える）
        const i = s.indexOf("{");
        const j = s.lastIndexOf("}");
        if (i >= 0 && j > i) s = s.slice(i, j + 1);
        return s;
      };
      const tryParse = (s) => {
        try { return JSON.parse(s); } catch { return null; }
      };

      parsed = tryParse(sanitize(txt));
    }

    if (!parsed) {
      throw new Error("MODEL_OUTPUT_NOT_JSON");
    }

    // --- 最小オブジェクトに整形（フロントは axes/total/advice/details を読む） ---
    const clip = (n) => Math.min(100, Math.max(0, Math.round(n)));
    const axes = Array.isArray(parsed.axes) ? parsed.axes.map(clip) : [0,0,0,0,0];

    // total がなければここで計算
    const weights = [0.25, 0.25, 0.20, 0.15, 0.15];
    const total = Number.isFinite(parsed.total)
      ? clip(parsed.total)
      : clip(axes.reduce((s, v, i) => s + v * weights[i], 0));

    const body = {
      axes,
      total,
      advice: parsed.advice || "",
      details: parsed.details || {}
    };

    // サーバ側で JSON 化して返す（フロント側はそのまま受け取るだけ）
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) })
    };
  }
}
