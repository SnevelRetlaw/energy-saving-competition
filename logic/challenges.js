import { fetchChallengesData } from "./data-fetcher.js";

export function initChallenges(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for challenges");
        return;
    }

    const refreshBtn = document.getElementById('challenges-refresh-button')
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchAndRenderChallenges(supabaseClient));
    }

    fetchAndRenderChallenges(supabaseClient);
}

async function fetchAndRenderChallenges(supabaseClient) {
    const data = await fetchChallengesData(supabaseClient);
    renderChallenges(data);
}

function renderChallenges(challenges) {
    const challengeList = document.getElementById("challenges-list");
    if (!challengeList) return;

    if (!challenges) {
        challengeList.innerHTML = '<li class="text-center py-4 text-gray-500">Fetching challenges failed</li>';
        return;
    }
    if (challenges.length === 0) {
        challengeList.innerHTML = '<li class="text-center py-4 text-gray-500">No challenges yet</li>';
        return;
    }
    
    challengeList.innerHTML = '';
    challenges.forEach((challenge) => {
        const card = `
            <li class="border border-gray-200 rounded bg-white overflow-hidden hover:shadow-md transition-shadow">
                <div class="p-4">
                    <div class="font-medium text-lg mb-1">${challenge.title}</div>
                    <div class="font-italic text-xs text-gray-600 mb-2">
                        <i>running from ${challenge.start} to ${challenge.end}</i>
                    </div>
                    <div class="text-gray-600 text-sm">${challenge.description}</div>
                </div>
            </li>
        `;
        challengeList.innerHTML += card;
    });
}