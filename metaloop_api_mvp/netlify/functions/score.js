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
- 出力は必ず **JSONのみ**。自然文は含めない。

出力仕様（上位キー3つは必須）：
{
  "axes": [n1,n2,n3,n4,n5],
  "total": n,
  "advice": "全体への一言助言（60字以内）",
  "details": {
    "axis_breakdown": [
      {"name":"顧客↔価値","score":n1,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…"},
      {"name":"価値↔収益","score":n2,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…"},
      {"name":"収益↔改善","score":n3,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…"},
      {"name":"改善↔顧客価値","score":n4,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…"},
      {"name":"継続動機","score":n5,"strengths":["…"],"improvements":["…"],"examples":["…"],"to_reach_100":"…"}
    ],
    "overall": {
      "top_strengths": ["全体的に優れている点（3つまで）"],
      "top_issues": ["改善すべき核心的課題（3つまで）"],
      "top_risks": ["前提崩れ・競合・規制など（2つまで）"],
      "missing_info_questions": ["情報不足を補う質問（5つまで）"],
      "prioritized_actions": [
        {"action":"最優先の改善","impact":5,"effort":2,"confidence":0.8,"rationale":"短文理由"},
        {"action":"第二優先","impact":4,"effort":2,"confidence":0.7,"rationale":"短文理由"},
        {"action":"第三優先","impact":3,"effort":1,"confidence":0.9,"rationale":"短文理由"}
      ],
      "summary": "全体講評（日本語200字以内）"
    }
  }
}
条件：
- 日本語で記述。
- 各配列要素は簡潔（1項目60字以内）。
- JSON構造を必ず閉じること。途中で改行しても良いが、文字列の途中で切らない。
- 入力が乏しい場合は厳しめに採点し、missing_info_questionsとto_reach_100を充実させる。
`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // 安定性重視
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `入力: ${JSON.stringify(payload)}` }
        ],
        temperature: 0.2,
        max_tokens: 2000  // ← JSONが長いので増加
      })
    });

    const data = await resp.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
}
