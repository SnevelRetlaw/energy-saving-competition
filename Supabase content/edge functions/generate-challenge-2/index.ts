import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CHALLENGEID = "11"

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

function getFourLowestUsages(data: RawData): number[] {
  const numericValues: number[] = [];
  
  for (const record of data.usages) {
    const usageValue: string = record['delivery_low'] ?? record['delivery_high'];
    const parsed = parseDutchNumber(usageValue);
    
    if (parsed !== null) {
      numericValues.push(parsed);
    }
  }
  
  numericValues.sort((a, b) => a - b);
  
  return numericValues.slice(0, 4);
}

function calculateStandbyUsage(usages: RawData): number {
  const fourLowestNumbers = getFourLowestUsages(usages)
  const estimatedStandbyUsagePerHour = fourLowestNumbers.reduce((sum, add) => sum + add, 0)
  const dailyStandbyUsage = estimatedStandbyUsagePerHour * 24
  return dailyStandbyUsage
}

function TESTgenerateChallengeProgressJson(baseline, daily_expected: number){
  const expected_difference = -5
  const json:PersonalChallengeProgress = {
    "12-05-2026": {
      day: "Tuesday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "13-05-2026": {
      day: "Wednesday",
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
    "23-05-2026": {
      day: "Saturday",
      baseline,
      expected: daily_expected,
      expected_difference,
      actual: null,
      actual_difference: null,
      feedback: null
    },
    "24-05-2026": {
      day: "Sunday",
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
  const results: Array<{ house_id: string; status: "ok" | "skipped" | "error"; error?: string; }> = [];

  const supabaseUrl = getEnvVar("SUPABASE_URL");
  const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // dates official: 2026-05-04 - 2026-05-17
  const baselineWeekStart = "2026-05-04"
  const baselineWeekEnd = "2026-05-17"
  // testdates: 2026-05-04 - 2026-05-11
  // const baselineWeekStart = "2026-05-04"
  // const baselineWeekEnd = "2026-05-10"

  const { data: participants, error: participantErr} = await supabase
    .from("SlimmemeterInfo")
    .select("house_id")

  if (participantErr) {
    return new Response(JSON.stringify({ error: "Failed to read SlimmemeterInfo", details: participantErr.message ?? participantErr }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  for(const house of participants){
    const {house_id} = house;
    const combinedRawData = [];
    let summedUsage = 0;
    
    const { data: raw_data, error: usageErr} = await supabase
      .from("Usage data")
      .select("raw_elec_data")
      .eq("house_id", house_id)
      .gte("date", baselineWeekStart)
      .lte("date", baselineWeekEnd)

    if (usageErr) {
      return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageErr.message ?? usageErr }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    
    if (raw_data.length === 0 ){
      results.push({house_id, status: "skipped", error: `No electricity data for period ${baselineWeekStart} to ${baselineWeekEnd}`})
      continue
    }

    for (const elec_usage of raw_data){
      const {raw_elec_data} = elec_usage
      if (raw_elec_data.usages.length === 0) continue
      
      combinedRawData.push(raw_elec_data)
    }
    
    const measuredDays = combinedRawData.length

    for (const day of combinedRawData){
      const filtered_elec_data = filterRawElecDataByTimeWindow(day, 1, 5);
      const dailyStandbyUsage = calculateStandbyUsage(filtered_elec_data)
      summedUsage += dailyStandbyUsage
    }

    const averageDailyStandbyUsage = summedUsage / measuredDays ?? null
    const expectedStandbyUsage = 0.95*averageDailyStandbyUsage

    const insertPayload = {
      house_id,
      challenge_id: CHALLENGEID,
      challenge_progress: generateChallengeProgressJson(averageDailyStandbyUsage, expectedStandbyUsage)
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