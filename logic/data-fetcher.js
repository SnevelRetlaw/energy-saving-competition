export async function fetchLeaderboardData(supabaseClient) {
    if (!supabaseClient) throw new Error("Supabase client missing");
    
    try {
        const { data, error } = await supabaseClient
            .from('Participants')
            .select('*')
            .order('score', { ascending: false });

        return data;
    } catch (err) {
        console.log("Fetching leaderboard failed:", err)
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

        console.log(data)

        return data.length > 0 ? data[0] : null;
    } catch (err) {
        console.error("Fetching challenges failed:", err);
        return null;
    }
}

export async function fetchInsightsData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");

    try{
        const { data, error } = await supabaseClient
            .from('Daily energy insight')
            .select('*')
            .order('date', { ascending: false });

        return data
    } catch (err){
        console.error("Fetching Daily Energy Insight failed:", err)
        return null
    }
}

export async function fetchUsageGraphData(supabaseClient) {
    if (!supabaseClient) throw new Error("Missing Supabase client");
    
    // TODO: Replace with actual query when energy consumption table is added
    // Example: await supabaseClient.from('EnergyLogs').select('*').eq('house_id', houseId)...
    return []; 
}

export async function fetchDashboardData(supabaseClient) {
    try {
        // 2. Run all fetches in parallel
        const [leaderboard, challenges, insights, usageData] = await Promise.all([
            fetchLeaderboardData(supabaseClient),
            fetchActiveChallengeData(supabaseClient),
            fetchInsightsData(supabaseClient),
            fetchUsageGraphData(supabaseClient)
        ]);

        return {
            leaderboard,
            challenges,
            insights,
            usageData
        };
    } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        throw err;
    }
}