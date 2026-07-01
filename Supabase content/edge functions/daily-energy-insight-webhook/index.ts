import { createClient } from "npm:@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type DbWebhookPayload = {
  type: "UPDATE" | "INSERT" | "DELETE" | string;
  table: string;
  schema: string;
  record: any;
  old_record?: any;
};

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function normalizeAnswer(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function getCorrectAnswer(quiz: unknown): unknown {
  if (!quiz || typeof quiz !== "object") return undefined;
  const q = quiz as Record<string, unknown>;
  return q["correct_answer"];
}

function calculateScore(given: unknown, correct: unknown): number {
  return normalizeAnswer(given) === normalizeAnswer(correct) ? 10 : 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const payload = (await req.json()) as DbWebhookPayload;
  if (payload.table !== "DEI progress" || payload.schema !== "public") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const record = payload?.record;
  if (!record) {
    return new Response(JSON.stringify({ error: "Missing record in payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const oldRecord = payload?.old_record;
  const oldCompleted = Boolean(oldRecord?.completed);
  const completed = Boolean(record?.completed);
  if (oldCompleted || completed) {
    return new Response(
      JSON.stringify({ ok: true, house: oldRecord.house_id, participants: "skipped (already completed)" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  const insightProgressId = record.id;
  const houseId = record.house_id;
  const DEIId = record.dei_id;

  const {data: quizData, error: fetchQuizErr} = await supabaseClient
    .from("Daily energy insight")
    .select('quiz')
    .eq('id', DEIId)

  if (fetchQuizErr){
    return new Response(
      JSON.stringify({ error: "Failed getting quiz from Daily energy insight", details: fetchQuizErr.message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const { quiz } = quizData[0];
  const givenAnswer = record.given_answer;
  const correctAnswer = getCorrectAnswer(quiz);
  const newScore = calculateScore(givenAnswer, correctAnswer);
  console.log('new score', newScore)

  const { error: insightErr } = await supabaseClient
    .from("DEI progress")
    .update({
      points: newScore,
      completed: true,
    })
    .eq("id", insightProgressId);

  if (insightErr) {
    return new Response(
      JSON.stringify({ error: "Failed updating Daily energy insight", details: insightErr.message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }

  if (houseId == null) {
    return new Response(
      JSON.stringify({ ok: true, insightProgressId, newScore, participants: "skipped (missing house_id)" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  // Update Participants score by adding the new score
  const { data: participantRow, error: selErr } = await supabaseClient
    .from("Participants")
    .select("score")
    .eq("auth_user_id", houseId)
    .maybeSingle();

  if (selErr) {
    return new Response(JSON.stringify({ error: "Failed selecting Participants", details: selErr.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  if (!participantRow) {
    return new Response(
      JSON.stringify({ ok: true, insightProgressId, newScore, participants: "skipped (no participant)" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  const current = participantRow.score ?? 0;
  console.log('current score', current, '; updating to', current + newScore)

  const { error: upErr } = await supabaseClient
    .from("Participants")
    .update({
      score: current + newScore,
    })
    .eq("auth_user_id", houseId);

  if (upErr) {
    return new Response(
      JSON.stringify({ error: "Failed updating Participants score", details: upErr.message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, insightProgressId, newScore, participants: "updated" }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
});
