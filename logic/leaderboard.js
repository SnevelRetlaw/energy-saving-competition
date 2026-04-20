export function initLeaderboard(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for leaderboard");
        return;
    }

    const refreshBtn = document.querySelector('#leaderboard-container + .tile-header button, #leaderboard-container button');
    // Note: The selector might need adjustment based on exact DOM structure if not using IDs on buttons
    // In the current HTML, the button is inside the header div.
    const header = document.querySelector('.tile-header');
    const btn = header ? header.querySelector('button[onclick*="Leaderboard"]') : null;
    
    if (btn) {
        btn.addEventListener('click', () => fetchAndUpdateLeaderboard(supabaseClient));
    }

    fetchAndUpdateLeaderboard(supabaseClient);
}

async function fetchLeaderboardData(supabaseClient) {
    try {
        const { data, error } = await supabaseClient
            .from('Participants')
            .select('*')
            .order('score', { ascending: false });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
        return null;
    }
}

async function fetchAndUpdateLeaderboard(supabaseClient) {
    const data = await fetchLeaderboardData(supabaseClient);
    renderLeaderboard(data);
}

function renderLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    if (!leaderboard) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">Could not retrieve data.</td></tr>';
        return;
    }
    if (leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No users found yet.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    leaderboard.forEach((participant, index) => {
        const row = `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 border-b font-bold">${index + 1}</td>
                <td class="py-2 px-4 border-b">${participant.house_name || participant.username || 'Unknown'}</td>
                <td class="py-2 px-4 border-b text-right font-mono">${participant.score}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}