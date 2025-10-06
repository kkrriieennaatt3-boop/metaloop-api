// netlify/functions/score.js
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}");

    const system = `あなたは新規事業の「閉ループ診断」アナリストです。
入力（why/who/value/delivery/money/feedback/driver）を読み、
5軸（1顧客↔価値,2価値↔収益,3収益↔改善,4改善↔顧客価値,5継続動機）を各0-100で採点。
重み [0.25,0.25,0.20,0.15,0.15] で合成スコア total(0-100) を算出。
空欄や曖昧さが強い場合は低めに。
JSONのみで返す: {"axes":[n1,n2,n3,n4,n5],"total":n,"advice":"短文(日本語)"}`;

    const user = `入力: ${JSON.stringify(payload)}`;

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
          { role: "user", content: user }
        ],
        temperature: 0.2
      })
    });

    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}
