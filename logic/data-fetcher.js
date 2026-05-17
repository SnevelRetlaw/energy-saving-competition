export async function fetchCurrentHouseName(supabaseClient, houseId = null){
    if (!houseId){
        houseId = (await supabaseClient.auth.getUser()).data.user.id
    }

    const {data: currentHouseName, error} = await supabaseClient
        .from("Participants")
        .select("house_name")
        .eq("auth_user_id", houseId)

    if (error) throw error

    return currentHouseName[0].house_name
}

export async function fetchLeaderboardData(supabaseClient) {
    if (!supabaseClient) throw new Error("Supabase client missing");
    
    try {
        const { data, error } = await supabaseClient
            .from('Participants')
            .select('*')
            .order('score', { ascending: false });

        return data;
    } catch (err) {
        console.error("Fetching leaderboard failed:", err)
        return null;
    }
}

export async function fetchActiveAndFinishedChallengesData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");
    const today = new Date().toISOString().split('T')[0]

    try {
        const { data, error } = await supabaseClient
            .from('Challenges')
            .select('*')
            .order('start', { ascending: true })
            .lte('start', today)

        return data
    } catch (err){
        console.error("Fetching challenges failed:", err)
        return null
    }

}

export async function fetchActiveOrLastChallengeData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");

    const today = new Date().toISOString().split('T')[0]

    try {
        const { data: activeChallengeList, error: activeChallengeError } = await supabaseClient
            .from('Challenges')
            .select('*')
            .lte('start', today)
            .gte('end', today)
            .order('start', { ascending: false })
            .limit(1);

        if (activeChallengeError) throw activeChallengeError

        if (activeChallengeList.length > 0){
            return activeChallengeList[0]
        }

        const { data: LatestChallenge, error: lastChallengeError } = await supabaseClient
            .from('Challenges')
            .select('*')
            .order('end', { ascending: false })
            .lte('start', today)
            .limit(1)

        if(lastChallengeError) throw lastChallengeError

        return LatestChallenge[0]
    } catch (err) {
        console.error("Fetching challenges failed:", err);
        return null;
    }
}

export async function fetchChallengeProgress(supabaseClient, challengeID, houseId){
    if (!supabaseClient) throw new Error("Missing Supabase client");

    try {
        const {data, error} = await supabaseClient
            .from('Challenge progress')
            .select('*')
            .eq('house_id', houseId)
            .in('challenge_id', challengeID)

        if (error) throw error

        return data
    } catch (err) {
        console.error(`Fetching challenge progress failed for house ${houseId}:`, err);
        return null
    }

}

export async function fetchAvailableDEIs(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");

    const today = new Date().toISOString().split('T')[0];

    try{
        const { data, error } = await supabaseClient
            .from('Daily energy insight')
            .select('*')
            .lte('date', today)
            .order('date', { ascending: true });

        return data
    } catch (err){
        console.error("Fetching Daily Energy Insight failed:", err)
        return null
    }
}

export async function fetchDEIProgress(supabaseClient, DEIId, houseId){
    if (!supabaseClient) throw new Error("Missing Supabase client");

    try{
        const { data, error } = await supabaseClient
            .from('DEI progress')
            .select('*')
            .in('dei_id', DEIId)
            .eq('house_id', houseId)

        return data
    } catch (err){
        console.error("Fetching Daily Energy Insight progress failed:", err)
        return null
    }
}

export async function fetchUsageGraphData(supabaseClient, startDate = null, endDate = null) {
    if (!supabaseClient) throw new Error("Supabase client not initialized");
    
    try {
        let query = supabaseClient
            .from('Usage data')
            .select('date, raw_elec_data, raw_gas_data')
            .order('date', { ascending: true });

        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        } else if (startDate) {
            query = query.gte('date', startDate);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error("Fetching usage data failed:", err);
        return [];
    }
}