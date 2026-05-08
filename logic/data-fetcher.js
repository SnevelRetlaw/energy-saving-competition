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

// export async function fetchChallengesData(supabaseClient) {
//     if (!supabaseClient) throw new Error("Missing Supabase client");

//     try {
//         const { data, error } = await supabaseClient
//             .from('Challenges')
//             .select('*')
//             .order('start', { ascending: false });

//         return data
//     } catch (err){
//         console.error("Fetching challenges failed:", err)
//         return null
//     }

// }

export async function fetchActiveChallengeData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");

    const today = new Date().toISOString().split('T')[0]

    try {
        const { data, error } = await supabaseClient
            .from('Challenges')
            .select('*')
            .lte('start', today)
            .gte('end', today)
            .order('start', { ascending: false })
            .limit(1);

        if (error) throw error;

        return data.length > 0 ? data[0] : null;
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
            .eq('challenge_id', challengeID)

        if (error) throw error

        return data
    } catch (err) {
        console.error(`Fetching challenge progress failed for house ${houseId}:`, err);
        return null
    }

}

export async function fetchInsightsData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");

    const today = new Date().toISOString().split('T')[0];

    try{
        const { data, error } = await supabaseClient
            .from('Daily energy insight')
            .select('*')
            .lte('date', today)
            .order('date', { ascending: false });

        return data
    } catch (err){
        console.error("Fetching Daily Energy Insight failed:", err)
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