// netlify/functions/score.js
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}");

    const system = `
あなたは新規事業の「閉ループ診断」アナリストです。
入力（why, who, value, delivery, money, feedback, driver）を読み、
下記の5軸を各0–100で厳密に採点してください：
1) 顧客↔価値（Problem-Solution Fit）
2) 価値↔収益（Value→Money変換の明確さ）
3) 収益↔改善（収益が学習に戻る設計）
4) 改善↔顧客価値（改善が価値向上に再接続）
5) 継続動機（習慣化/コミュニティ/ネットワーク効果等）

重み [0.25,0.25,0.20,0.15,0.15] で total(0–100) を算出。
total = round( Σ(weight_i * axis_i) )。境界は整数(0–100)。

評価方針：
- 空欄・曖昧語（例：すごい/多分/検討）・検証不能な主張は減点。
- 具体性（誰が/何に払う/単価/頻度/導線/行動ログ/改善サイクル）を加点。
- 出力は必ず JSON のみ。自然文は入れない。

出力仕様（互換性のため上位3キーは必須）：
{
  "axes": [n1,n2,n3,n4,n5],
  "total": n,
  "advice": "全体への一言助言（日本語、60字以内）",
  "details": {
    "axis_breakdown": [
      { "name":"顧客↔価値","score":n1,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…" },
      { "name":"価値↔収益","score":n2,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…" },
      { "name":"収益↔改善","score":n3,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…" },
      { "name":"改善↔顧客価値","score":n4,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…" },
      { "name":"継続動機","score":n5,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…" }
    ],
    "overall": {
      "top_strengths": ["…"],
      "top_issues": ["…"],
      "top_risks": ["…"],
      "missing_info_questions": ["…"],
      "suggested_experiments": [
        {
          "name": "実験名",
          "metric": "主要指標",
          "target": "目標値",
          "fermi_estimate": {"users_needed": 300, "time_window_days": 14},
          "rationale": "仮説"
        }
      ],
      "kpis": {
        "north_star": "…",
        "leading": ["…"],
        "lagging": ["…"]
      },
      "prioritized_actions": [
        {"action":"最優先の改善","impact":5,"effort":2,"confidence":0.7,"rationale":"短文"},
        {"action":"第二優先","impact":4,"effort":2,"confidence":0.6,"rationale":"短文"},
        {"action":"第三優先","impact":3,"effort":1,"confidence":0.8,"rationale":"短文"}
      ],
      "loop_diagnostics": {
        "customer_value_fit": 0,
        "value_money_fit": 0,
        "money_feedback_fit": 0,
        "feedback_value_fit": 0,
        "driver_strength": 0,
        "bottleneck": "最も弱い接続の説明（1文）"
      },
      "summary": "全体講評（日本語200字以内）"
    }
  }
}
文字列はすべて日本語。各配列要素は簡潔（1項目あたり60字以内）。計算は整数化。
入力が乏しい場合は、厳しめに採点し、"missing_info_questions" と "to_reach_100" を充実させる。
`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // 精度を上げたい時は "gpt-4o"
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `入力: ${JSON.stringify(payload)}` }
        ],
        temperature: 0.2,   // ← ** を消して通常のプロパティに
        max_tokens: 1200    // ← 同上
      })
    });

    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}
