import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHALLENGEID = "13"

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

type DatesArray = Array<[start: string, end: string]>;

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

function aggregateElecData(elec_data: RawData): number | null {
  const usages = Array.isArray(elec_data?.usages) ? elec_data.usages : [];
  if (usages.length === 0) return null

  let sum = 0;
  for (const row of usages) {
    sum += parseDutchNumber(typeof row["delivery_high"] === "string" ? row["delivery_high"] : "0") ?? 0
    sum += parseDutchNumber(typeof row["delivery_low"] === "string" ? row["delivery_low"] : "0") ?? 0
  }

  return sum;
}

function TESTgenerateChallengeProgressJson(baseline: number, daily_expected: number){
  const expected_difference = 0
  const json:PersonalChallengeProgress = {
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
  const expected_difference = 0
  const json:PersonalChallengeProgress = {
    "01-06-2026": {
      day: "Monday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "02-06-2026": {
      day: "Tuesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "03-06-2026": {
      day: "Wednesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "04-06-2026": {
      day: "Thursday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "05-06-2026": {
      day: "Friday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "06-06-2026": {
      day: "Satuday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "07-06-2026": {
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

  // dates official: 2026-05-04 - 2026-05-29
  const week1Start = "2026-05-04"
  const week1End = "2026-05-10"
  const week2Start = "2026-05-11"
  const week2End = "2026-05-17"
  const week3Start = "2026-05-18"
  const week3End = "2026-05-24"
  const week4Start = "2026-05-25"
  const week4End = "2026-05-29"
  // testdates: 2026-05-04 - 2026-05-13
  // const week1Start = "2026-05-04"
  // const week1End = "2026-05-05"
  // const week2Start = "2026-05-06"
  // const week2End = "2026-05-07"
  // const week3Start = "2026-05-08"
  // const week3End = "2026-05-09"
  // const week4Start = "2026-05-10"
  // const week4End = "2026-05-11"
  const datesArray: DatesArray = [[week1Start, week1End],[week2Start, week2End],[week3Start, week3End],[week4Start, week4End]]

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
    let lowestAverageUsage = Number.MAX_SAFE_INTEGER
    
    for(const week of datesArray){
      const start = week[0], end = week[1]
      const { data: raw_data, error: usageErr} = await supabase
        .from("Usage data")
        .select("raw_elec_data")
        .eq("house_id", house_id)
        .gte("date", start)
        .lte("date", end)

      if (usageErr) {
        return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageErr.message ?? usageErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      const baslineUsageData = [];
      let summedUsage = 0;

      for (const elec_data of raw_data){
        const {raw_elec_data} = elec_data
        if (raw_elec_data.usages.length === 0) continue
        
        baslineUsageData.push(raw_elec_data)
      }

      const measuredDays = baslineUsageData.length

      for (const day of baslineUsageData){
        summedUsage += aggregateElecData(day)
      }

      const averageDailyUsage = summedUsage / measuredDays ?? null
      if (averageDailyUsage < lowestAverageUsage){
        lowestAverageUsage = averageDailyUsage
      }
    }
    
    const insertPayload = {
      house_id,
      challenge_id: CHALLENGEID,
      challenge_progress: generateChallengeProgressJson(lowestAverageUsage, lowestAverageUsage)
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