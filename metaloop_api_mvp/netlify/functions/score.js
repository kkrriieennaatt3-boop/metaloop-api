// netlify/functions/score.js
export async function handler(event) {
  try {
    const payload = JSON.parse(event.body || "{}");

    // --- 採点ポリシー＆出力仕様（JSONのみ/最後まで閉じることを強制） ---
    const system = `
あなたは新規事業の「閉ループ診断」アナリストです。
入力（why, who, value, delivery, money, feedback, driver）を読み、5軸を各0–100で厳密に採点してください：
1) 顧客↔価値（Problem-Solution Fit）
2) 価値↔収益（Value→Money変換の明確さ）
3) 収益↔改善（収益が学習に戻る設計）
4) 改善↔顧客価値（改善が価値向上に再接続）
5) 継続動機（習慣化/コミュニティ/ネットワーク効果等）

重み [0.25,0.25,0.20,0.15,0.15] で total(0–100) を算出（整数, 四捨五入）。
評価方針：空欄・曖昧語・検証不能主張は減点。具体性（誰が/何に払う/単価/頻度/導線/行動ログ/改善サイクル）を加点。
出力は必ず **JSONオブジェクトのみ**（自然文禁止）。

出力仕様（上位キー3つは必須）：
{
  "axes": [n1,n2,n3,n4,n5],          // 各軸0–100（整数）
  "total": n,                         // 0–100（整数）
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
      "top_strengths": ["全体の良い点（最大3）"],
      "top_issues": ["本質的な課題（最大3）"],
      "top_risks": ["前提崩れ・競合・規制など（最大2）"],
      "missing_info_questions": ["不足情報を埋める質問（最大5）"],
      "prioritized_actions": [
        {"action":"最優先の改善","impact":5,"effort":2,"confidence":0.8,"rationale":"短文理由"},
        {"action":"第二優先","impact":4,"effort":2,"confidence":0.7,"rationale":"短文理由"},
        {"action":"第三優先","impact":3,"effort":1,"confidence":0.9,"rationale":"短文理由"}
      ],
      "summary": "全体講評（200字以内）"
    }
  }
}
条件：
- すべて日本語。配列要素は各60字以内。
- 入力が乏しい場合は厳しめに採点し、missing_info_questions と to_reach_100 を充実させる。
- ⚠️ 出力は**完全なJSON**で終了させること。途中省略（...）や未閉鎖を含めない。
`;

    // --- 応答タイムアウト対策（AbortController） ---
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000); // 60s

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o", // ← 長文/構造化の安定性重視。miniで切れる場合がある
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: `入力: ${JSON.stringify(payload)}` }
        ],
        temperature: 0.2,
        max_tokens: 2500
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    const raw = await resp.json();

    // --- モデル出力取り出し（複数形態に対応） ---
    let txt =
      raw?.choices?.[0]?.message?.content ??
      raw?.output?.[0]?.content?.[0]?.text ??
      raw?.output_text ?? "";

    // 文字列のJSONを頑丈にパース（スマートクォート/コードフェンス/前後説明の除去）
    const sanitize = (s) => {
      if (typeof s !== "string") return s;
      s = s.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
      s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      const i = s.indexOf("{");
      const j = s.lastIndexOf("}");
      if (i >= 0 && j > i) s = s.slice(i, j + 1);
      return s;
    };
    const tryParse = (s) => {
      try { return JSON.parse(s); } catch { return null; }
    };

    let parsed =
      (txt && typeof txt === "object") ? txt : tryParse(sanitize(txt));

    if (!parsed) {
      throw new Error("MODEL_OUTPUT_NOT_JSON");
    }

    // --- 整形して最小オブジェクトに（フロントはこれだけ読めばOK） ---
    const clip = (n) => Math.min(100, Math.max(0, Math.round(n)));
    const axes = Array.isArray(parsed.axes) ? parsed.axes.map(clip) : [0,0,0,0,0];

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
