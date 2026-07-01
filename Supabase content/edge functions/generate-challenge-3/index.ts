import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHALLENGEID = "12"

type UsageResponse = {
  meter_identifier?: string;
  usages: Array<Record<string, string>>;
};

type RawData = UsageResponse & {
  usages: Array<Record<string, string>>;
};

type PersonalChallengeProgress = Record<
  string,
  {
    day: string;
    baseline: number;
    expected: number;
    expected_difference: number;
    actual: number;
    actual_difference: number;
    feedback: number;
  }  
>;

function getEnvVar(variable: string): string {
  const v = Deno.env.get(variable)
  if (!v) throw new Error(`Missing required environment variable: ${variable}`)
  return v
}

function parseDutchNumber(dutch_number_str: string) {
    if (!dutch_number_str) return null;
    const cleanStr = String(dutch_number_str)
        .replace(/\./g, '')      // Remove thousands separators (dots)
        .replace(',', '.');      // Replace decimal comma with dot
    return parseFloat(cleanStr) || null;
};

function aggregateGasData(elec_data: RawData): number | null {
  const usages = Array.isArray(elec_data?.usages) ? elec_data.usages : [];
  if (usages.length === 0) return null

  let sum = 0;
  for (const row of usages) {
    sum += parseDutchNumber(typeof row["delivery"] === "string" ? row["delivery"] : "0") ?? 0
  }

  return sum;
}

function TESTgenerateChallengeProgressJson(baseline: number, daily_expected: number){
  const expected_difference = -5
  const json:PersonalChallengeProgress = {    
    "13-05-2026": {
      day: "Wednesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "14-05-2026": {
      day: "Thursday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "15-05-2026": {
      day: "Friday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    }
  };
  return json
}

function generateChallengeProgressJson(baseline: number, daily_expected: number){
  const expected_difference = -5
  const json:PersonalChallengeProgress = {
    "25-05-2026": {
      day: "Monday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "26-05-2026": {
      day: "Tuesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "27-05-2026": {
      day: "Wednesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "28-05-2026": {
      day: "Thursday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "29-05-2026": {
      day: "Friday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "30-05-2026": {
      day: "Satuday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "31-05-2026": {
      day: "Sunday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
  };
  return json
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }
  const results = {}

  const supabaseUrl = getEnvVar("SUPABASE_URL");
  const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // dates official: 2026-05-04 - 2026-05-22
  const baselineStart = "2026-05-04"
  const baselineEnd = "2026-05-22"
  // testdates: 2026-05-04 - 2026-05-12
  // const baselineStart = "2026-05-04"
  // const baselineEnd = "2026-05-12"

  const { data: participants, error: participantErr} = await supabase
    .from("SlimmemeterInfo")
    .select("house_id")

  if (participantErr) {
    return new Response(JSON.stringify({ error: "Failed to read SlimmemeterInfo", details: participantErr.message ?? participantErr }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Loop per participant
  for(const house of participants){
    const {house_id} = house;
    const baslineUsageData = [];
    let summedUsage = 0;
    
    const { data: raw_data, error: usageErr} = await supabase
      .from("Usage data")
      .select("raw_gas_data")
      .eq("house_id", house_id)
      .gte("date", baselineStart)
      .lte("date", baselineEnd)

    if (usageErr) {
      return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageErr.message ?? usageErr }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    for (const gas_data of raw_data){
      const {raw_gas_data} = gas_data
      if (raw_gas_data.usages.length === 0) continue
      
      baslineUsageData.push(raw_gas_data)
    }

    const measuredDays = baslineUsageData.length

    for (const day of baslineUsageData){
      summedUsage += aggregateGasData(day)
    }

    const averageDailyUsage = summedUsage / measuredDays ?? null
    const expectedUsage = 0.95*averageDailyUsage

    const insertPayload = {
      house_id,
      challenge_id: CHALLENGEID,
      challenge_progress: generateChallengeProgressJson(averageDailyUsage, expectedUsage)
    }
    const { error: insErr } = await supabase.from("Challenge progress").insert(insertPayload)

    if (insErr) {
      return new Response(JSON.stringify({ error: "Failed to update challenge progress", details: insErr.message ?? insErr }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});