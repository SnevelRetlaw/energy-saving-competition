import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHALLENGEID = "10"

type UsageResponse = {
  meter_identifier?: string;
  usages: Array<Record<string, unknown>>;
};

type RawData = UsageResponse & {
  usages: Array<Record<string, unknown>>;
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

function filterRawElecDataByTimeWindow(raw_elec_data: RawData, startHourUTC: number, endHourUTC: number) {
  const usages = Array.isArray(raw_elec_data?.usages) ? raw_elec_data.usages : [];

  const filtered = usages.filter((u) => {
    const t = u["time"];
    if (typeof t !== "string") return false;
    const dateParts = t.split(" ")
    const timeParts = dateParts[1].split(":")
    const hour = +timeParts[0]
    return hour >= startHourUTC && hour < endHourUTC; // Not inclusive end hour because that would add 21:00 - 21:15
  });

  return {
    meter_identifier: raw_elec_data?.meter_identifier,
    usages: filtered,
  };
}

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
    "12-05-2026": {
      day: "Tuesday",
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
    },
    "16-05-2026": {
      day: "Saturday",
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

function generateChallengeProgressJson(baseline: number, daily_expected: number){
  const expected_difference = -5
  const json:PersonalChallengeProgress = {
    "18-05-2026": {
      day: "Monday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "19-05-2026": {
      day: "Tuesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "20-05-2026": {
      day: "Wednesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "21-05-2026": {
      day: "Thursday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "22-05-2026": {
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

  // dates official: 2026-05-04 - 2026-05-08 and 2026-05-11 - 2026-05-15
  const firstWeekStart = "2026-05-04"
  const firstWeekEnd = "2026-05-08"
  const secondWeekStart = "2026-05-11"
  const secondWeekEnd = "2026-05-15"
  // testdates: 2026-04-20 - 2026-04-24 and 2026-04-27 - 2026-05-01
  // const firstWeekStart = "2026-04-20"
  // const firstWeekEnd = "2026-04-24"
  // const secondWeekStart = "2026-04-27"
  // const secondWeekEnd = "2026-05-01"

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
    const combinedRawData = [];
    let summedUsage = 0;
    // collect data from dates
    const { data: raw_data_week_1, error: usageErr} = await supabase
      .from("Usage data")
      .select("raw_elec_data")
      .eq("house_id", house_id)
      .gte("date", firstWeekStart)
      .lte("date", firstWeekEnd)

    if (usageErr) {
      return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageErr.message ?? usageErr }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    for (const elec_week_1 of raw_data_week_1){
      const {raw_elec_data} = elec_week_1
      if (raw_elec_data.usages.length === 0) continue
      
      combinedRawData.push(raw_elec_data)
    }

    const { data: raw_data_week_2, error: usageWeek2Err} = await supabase
      .from("Usage data")
      .select("raw_elec_data")
      .eq("house_id", house_id)
      .gte("date", secondWeekStart)
      .lte("date", secondWeekEnd)

    if (usageWeek2Err) {
      return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageWeek2Err.message ?? usageWeek2Err }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    for (const elec_week_2 of raw_data_week_2){
      const {raw_elec_data} = elec_week_2
      if (raw_elec_data.usages.length === 0) continue
      
      combinedRawData.push(raw_elec_data)
    }
    const measuredDays = combinedRawData.length

    // filter data to only include 16:00 - 20:45 + sum all datapoints
    for (const day of combinedRawData){
      const filtered_elec_data = filterRawElecDataByTimeWindow(day, 16, 21);
      const sum = aggregateElecData(filtered_elec_data)
      summedUsage += sum
    }

    // Divide by #days
    const averageDailyUsage = summedUsage / measuredDays ?? null
    const expectedUsage = 0.95*averageDailyUsage

    // insert new value in challenge_progress table
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