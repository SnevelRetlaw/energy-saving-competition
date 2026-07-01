import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { formatDateSMP, formatDate, parseDutchNumber, getEnvVar } from "./helperFunctions.ts"

const SMP_BASE_URL = "https://app.slimmemeterportal.nl/userapi/v1";
const CHALLENGE_1_ID = 10
const CHALLENGE_2_ID = 11
const CHALLENGE_3_ID = 12
const CHALLENGE_4_ID = 13


type SMPInfo = {
  house_id: string;
  api_key: string;
  gas_id: string | null;
  elec_id: string | null;
};

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

type PublicChallengeProgress = {
    actual_difference: number;
    actual: number;
    expected: number;
    expected_difference: number;
    baseline: number;
  };

async function fetchUsage(params: { apiKey: string; connectionId: string | number; date: string; }): Promise<UsageResponse> {
  const { apiKey, connectionId, date } = params;
  const url = `${SMP_BASE_URL}/connections/${connectionId}/usage/${date}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "API-Key": apiKey,
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Slimmemeter request failed (${resp.status}) for connectionId=${connectionId}: ${text}`);
  }

  return (await resp.json()) as UsageResponse;
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

function aggregateGasData(gas_data: RawData): number {
  const usages = gas_data.usages ?? []
  if (usages.length === 0) return null

  let sum = 0;
  for (const row of usages){
    sum += parseDutchNumber(typeof row["delivery"] === "string" ? row["delivery"] : "0") ?? 0
  }

  return sum
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

function computeFeedback(expected_difference: number, actual_difference: number | null): number {
  if (actual_difference === null || !Number.isFinite(actual_difference)) return 0;
  if (actual_difference > expected_difference) return -1;
  if (actual_difference === 0) return 0;
  return 1;
}

function updateChallengeProgress(params: {
  challenge_progress: PersonalChallengeProgress;
  yesterday: string;
  actualUsage: number;
}) {
  const { challenge_progress, yesterday, actualUsage } = params;

  const progressObj = (challenge_progress ?? {}) as PersonalChallengeProgress;
  const entry = progressObj?.[yesterday];
  if (!entry) {
    return progressObj;
  }

  const baseline = entry.baseline;

  let actualDifference: number | null = null;
  if (baseline !== null && actualUsage !== null && baseline !== 0) {
    actualDifference = ((actualUsage - baseline) / baseline * 100);
  }
  const insertDifference =
    actualDifference === null || !Number.isFinite(actualDifference) ? 0 : actualDifference;

  const feedback = computeFeedback(entry.expected_difference, actualDifference);

  progressObj[yesterday] = {
    ...entry,
    actual: actualUsage,
    actual_difference: insertDifference,
    feedback: feedback,
  };

  return progressObj;
}

async function computeChallengeWeek1(params: {
  challenge_progress: PersonalChallengeProgress;
  raw_elec_data: RawData;
  yesterday_unformatted: string;
}) {
  const { challenge_progress, raw_elec_data, yesterday_unformatted } = params;
  const yesterday = formatDateSMP(yesterday_unformatted);
  const filtered_elec_data = filterRawElecDataByTimeWindow(raw_elec_data, 16, 21);

  const actualUsage = aggregateElecData(filtered_elec_data);

  const nextChallengeProgress = updateChallengeProgress({
    challenge_progress: challenge_progress,
    yesterday: yesterday,
    actualUsage,
  });

  return nextChallengeProgress;
}

async function computeChallengeWeek2(params: {
  challenge_progress: PersonalChallengeProgress;
  raw_elec_data: RawData;
  yesterday_unformatted: string;
}) {
  const { challenge_progress, raw_elec_data, yesterday_unformatted } = params;
  const yesterday = formatDateSMP(yesterday_unformatted);
  const filtered_elec_data = filterRawElecDataByTimeWindow(raw_elec_data, 1, 5);

  const standbyUsage = calculateStandbyUsage(filtered_elec_data)

  const nextChallengeProgress = updateChallengeProgress({
    challenge_progress: challenge_progress,
    yesterday: yesterday,
    actualUsage: standbyUsage,
  });

  return nextChallengeProgress;
}

async function computeChallengeWeek3(params: {
  challenge_progress: PersonalChallengeProgress;
  raw_gas_data: RawData;
  yesterday_unformatted: string;
}) {
  const { challenge_progress, raw_gas_data, yesterday_unformatted } = params;
  const yesterday = formatDateSMP(yesterday_unformatted);

  const gasUsage = aggregateGasData(raw_gas_data)

  const nextChallengeProgress = updateChallengeProgress({
    challenge_progress: challenge_progress,
    yesterday: yesterday,
    actualUsage: gasUsage,
  });

  return nextChallengeProgress;
}

async function computeChallengeWeek4(params: {
  challenge_progress: PersonalChallengeProgress;
  raw_elec_data: RawData;
  yesterday_unformatted: string;
}) {
  const { challenge_progress, raw_elec_data, yesterday_unformatted } = params;
  const yesterday = formatDateSMP(yesterday_unformatted);

  const elecUsage = aggregateElecData(raw_elec_data)

  const nextChallengeProgress = updateChallengeProgress({
    challenge_progress: challenge_progress,
    yesterday: yesterday,
    actualUsage: elecUsage,
  });

  return nextChallengeProgress;
}

async function isUsagedDataPresent(params: {supabase, date: Date, house_id: string}){
  const {supabase, date, house_id} = params

  const {data: usageData, error: usageError} = await supabase
    .from("Usage data")
    .select()
    .eq("house_id", house_id)
    .eq("date", date)

  if (usageError) throw usageError

  return usageData.length > 0
}

async function updateUsageData(params: {supabase,  yesterday_unformatted: Date}){
  const {supabase, yesterday_unformatted} = params
  const smpYesterday = formatDateSMP(yesterday_unformatted);
  const usageDataYesterday = formatDate(yesterday_unformatted)

  const { data: rows, error: listErr } = await supabase
      .from("SlimmemeterInfo")
      .select("house_id, api_key, gas_id, elec_id") as { data: SMPInfo[] | null; error: any };

  if (listErr) {
    return new Response(JSON.stringify({ error: "Failed to read SlimmemeterInfo", details: listErr.message ?? listErr }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const inputRows = rows ?? [];

  const results: Array<{ house_id: SMPInfo["house_id"]; status: "ok" | "skipped" | "error"; error?: string; }> = [];

  for (const r of inputRows) {
    const house_id = r.house_id;
    const api_key = r.api_key;
    const gas_id = r.gas_id;
    const elec_id = r.elec_id;

    if (await isUsagedDataPresent({supabase, date: usageDataYesterday, house_id})) {
      results.push({house_id, status: "skipped", error: "Data is already present"})
      continue
    }

    // Basic guardrails
    if (!api_key || api_key.trim().length === 0) {
      results.push({ house_id, status: "skipped", error: "Missing api_key" });
      continue;
    }

    try {
      if (gas_id == null || elec_id == null) {
        results.push({ house_id, status: "skipped", error: "Missing gas_id or elec_id" });
        continue;
      }

      const raw_gas_data = await fetchUsage({ apiKey: api_key, connectionId: gas_id, date: smpYesterday });
      const raw_elec_data = await fetchUsage({ apiKey: api_key, connectionId: elec_id, date: smpYesterday });
      
      // Do not add new rows if there is no usage.
      if (raw_elec_data.usages.length === 0 || raw_gas_data.usages.length === 0){
        results.push({ house_id, status: "skipped", error: "No data in SMP"})
        continue
      }

      const insertPayload = {
        house_id,
        date: yesterday_unformatted,
        raw_gas_data,
        raw_elec_data
      };
      
      const { error: insErr } = await supabase.from("Usage data").insert(insertPayload);
      if (insErr) throw insErr;
      
      results.push({ house_id, status: "ok"})
      
    } catch (e) {
      results.push({ house_id, status: "error", error: e.message });
    }
  }
  return results
}

function calculatePoints(actual_difference: number, expected_difference: number, challengeId: number): number {
  if (actual_difference > expected_difference) return 0
  if (challengeId === CHALLENGE_2_ID) return 25
  return 50
}

async function updateActiveChallenges(params: {supabase, yesterday_unformatted}){
  const {supabase, yesterday_unformatted} = params
  const yesterday  = formatDate(yesterday_unformatted)
  const yesterdaySmp = formatDateSMP(yesterday_unformatted);
  const results: Array<{ house_id: SMPInfo["house_id"]; status: "ok" | "skipped" | "error"; error?: string; }> = [];
  
  const { data: activeChallenges, error: chErr } = await supabase
    .from("Challenges")
    .select("id, end")
    .lte("start", yesterday)
    .gte("end", yesterday);

  if (chErr) {
    return new Response(JSON.stringify({ error: "Failed to read Challenges", details: chErr.message ?? chErr }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: participants, error: participantError } = await supabase
    .from("SlimmemeterInfo")
    .select("house_id")

  if (participantError) {
    return new Response(JSON.stringify({ error: "Failed to read Participants", details: participantError.message ?? participantError }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // loop: per active challenge
  for (const activeChallenge of activeChallenges){
    const { id: challengeId, end: challengeEnd } = activeChallenge
    for (const house of participants){

      const { house_id } = house

      const { data: raw_data, error: usageErr} = await supabase
        .from("Usage data")
        .select("raw_elec_data, raw_gas_data")
        .eq("house_id", house_id)
        .eq("date", yesterday);
        
      if (usageErr) {
        return new Response(JSON.stringify({ error: "Failed to read Usage data", details: usageErr.message ?? usageErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      
      if (raw_data.length < 1) {
        results.push({house_id, status: "skipped", error: "No usage data in database"})
        continue
      }

      const { raw_elec_data, raw_gas_data} = raw_data[0]

      const { data: challenge_progress_list, error: chalProgErr} = await supabase
        .from("Challenge progress")
        .select("id, challenge_progress")
        .eq("challenge_id", challengeId)
        .eq("house_id", house_id)
                
      if (chalProgErr) {
        return new Response(JSON.stringify({ error: "Failed to read Usage data", details: chalProgErr.message ?? chalProgErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
      if (challenge_progress_list.length < 1){
        results.push({house_id, status:"skipped", error:`No progress list present for challenge ${challengeId}`})
        continue
      }

      const { id: progressId, challenge_progress } = challenge_progress_list[0]

      if (challenge_progress[yesterdaySmp].actual !== null){
        results.push({house_id, status: "skipped", error: `Progress already computed for challenge ${challengeId}`})
        continue
      }

      let nextProgress = null
      if (challengeId === CHALLENGE_1_ID){
        nextProgress = await computeChallengeWeek1({challenge_progress, raw_elec_data, yesterday_unformatted});
      }
      if (challengeId === CHALLENGE_2_ID){
        nextProgress = await computeChallengeWeek2({challenge_progress, raw_elec_data, yesterday_unformatted})
      }
      if (challengeId === CHALLENGE_3_ID){
        nextProgress = await computeChallengeWeek3({challenge_progress, raw_gas_data, yesterday_unformatted})
      }
      if (challengeId === CHALLENGE_4_ID){
        nextProgress = await computeChallengeWeek4({challenge_progress, raw_elec_data, yesterday_unformatted})
      }

      const { error: upErr } = await supabase
        .from("Challenge progress")
        .update({challenge_progress: nextProgress,})
        .eq("id", progressId);

      if (upErr) {
        return new Response(JSON.stringify({ error: "Failed to update challenge progress", details: upErr.message ?? upErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      // Calculate Cumulative value    
      const { data: all_houses_challenge_progress_list, error: allHouseProgressErr } = await supabase
        .from("Challenges")
        .select("challenge_progress_all_houses")
        .eq("id", challengeId)

      if (allHouseProgressErr) {
        return new Response(JSON.stringify({ error: "Failed to update challenge progress", details: allHouseProgressErr.message ?? allHouseProgressErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      const { challenge_progress_all_houses }  = all_houses_challenge_progress_list[0]
      const cumulative: Record<string, PublicChallengeProgress> = challenge_progress_all_houses ?? {}
      
      const { data: house_name_list, error: hn_error} = await supabase
          .from("Participants")
          .select("house_name")
          .eq("auth_user_id", house_id)
          .limit(1)

      if (hn_error){
        throw hn_error
      }

      let actual = 0.0, baseline = 0.0, expected = 0.0;
      
      const { house_name } = house_name_list[0]
      if (house_name in cumulative) {
        const currentCumulative = cumulative[house_name]
        actual = currentCumulative.actual ?? 0
        baseline = currentCumulative.baseline ?? 0
        expected = currentCumulative.expected ?? 0
      }
      actual += nextProgress[yesterdaySmp].actual;
      baseline += nextProgress[yesterdaySmp].baseline;
      expected += nextProgress[yesterdaySmp].expected

      let actualDifference: number | null = null;
      if (baseline !== null && actual !== null && baseline !== 0) {
        actualDifference = ((actual - baseline) / baseline) * 100;
      }

      const expectedDifference = nextProgress[yesterdaySmp].expected_difference
      cumulative[house_name] = {actual_difference: actualDifference, actual, baseline, expected, expected_difference: expectedDifference}

      // update challenge_progress_all_houses in supabase
      const { error: cumulativeErr} = await supabase
        .from("Challenges")
        .update({challenge_progress_all_houses: cumulative})
        .eq("id", challengeId)

      if (cumulativeErr) {
        return new Response(JSON.stringify({ error: "Failed to update challenge progress", details: cumulativeErr.message ?? cumulativeErr }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }

      // Finish completed challenges
      if (yesterday === challengeEnd){
        const expectedDifference = nextProgress[yesterdaySmp].expected_difference
        const points = calculatePoints(actualDifference, expectedDifference, challengeId)
        const insertPayload = {
          completed: true,
          points
        }

        const {error: challengeCompErr} = await supabase
          .from("Challenge progress")
          .update(insertPayload)
          .eq("house_id", house_id)
          .eq("challenge_id", challengeId)

        if (challengeCompErr) {
          return new Response(JSON.stringify({ error: "Failed to update challenge completed", details: challengeCompErr.message ?? challengeCompErr }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const {data: score, error: getScoreErr} = await supabase
          .from("Participants")
          .select("score")
          .eq("auth_user_id", house_id)

        if (getScoreErr) {
          return new Response(JSON.stringify({ error: "Failed to get participant's score", details: getScoreErr.message ?? getScoreErr }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const {score: currentScore} = score[0]

        const {error: updatePointsErr} = await supabase
          .from("Participants")
          .update({score: currentScore + points})
          .eq("auth_user_id", house_id)

        if (updatePointsErr) {
          return new Response(JSON.stringify({ error: "Failed to update participant's score", details: updatePointsErr.message ?? updatePointsErr }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      results.push({house_id, status: 'ok'})
    }
  }
  return results
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = getEnvVar("SUPABASE_URL");
  const serviceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const yesterday_unformatted = new Date(Date.now() - 24 * 60 *60 * 1000);

  const results = await updateUsageData({supabase, yesterday_unformatted})
  const updateResults = await updateActiveChallenges({supabase, yesterday_unformatted})
      
  return new Response(JSON.stringify({ date: yesterday_unformatted, results, updateResults }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
