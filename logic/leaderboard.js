import { fetchLeaderboardData } from './data-fetcher.js';

export function initLeaderboard(supabaseClient) {
    if (!supabaseClient) return;

    // Find the refresh button specifically for the leaderboard tile
    // The HTML structure puts the button inside the tile-header div
    const refreshBtn = document.getElementById('leaderboard-refresh-btn')

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchAndRenderLeaderboard(supabaseClient));
    } else {
        console.log("No refresh button")
    }

    // Initial load
    fetchAndRenderLeaderboard(supabaseClient);
}

async function fetchAndRenderLeaderboard(supabaseClient) {
    const data = await fetchLeaderboardData(supabaseClient);
    renderLeaderboard(data);
}

function renderLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    if (!leaderboard || leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">No data available.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    leaderboard.forEach((participant, index) => {
        const row = `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="py-2 px-4 border-b font-bold text-gray-700">${index + 1}</td>
                <td class="py-2 px-4 border-b text-gray-800">${participant.house_name || 'Unknown House'}</td>
                <td class="py-2 px-4 border-b text-right font-mono font-semibold text-green-700">${participant.score}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}