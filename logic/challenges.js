import { fetchActiveChallengeData } from "./data-fetcher.js";

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

export async function fetchAndRenderChallenges(supabaseClient) {
    const challenge = await fetchActiveChallengeData(supabaseClient);
    renderChallenge(challenge);

    const showMoreBtn = document.getElementById('show-more-btn')
    if(showMoreBtn){
        showMoreBtn.addEventListener('click', () => openDetailView(challenge))
    }
}

function renderChallenge(challenge) {
    const challengeList = document.getElementById("challenges-list");
    if (!challengeList) return;

    if (!challenge) {
        challengeList.innerHTML = '<li class="text-center py-4 text-gray-500">Fetching challenges failed</li>';
        return;
    }
    if (challenge.length === 0) {
        challengeList.innerHTML = '<li class="text-center py-4 text-gray-500">No challenges yet</li>';
        return;
    }

    const shortDesc = challenge.description.length > 100 ? challenge.description.substring(0,100) + '...' : challenge.description
    
    challengeList.innerHTML =  `
            <li class="border border-gray-200 rounded bg-white overflow-hidden hover:shadow-md transition-shadow">
                <div class="p-4">
                    <div class="font-medium text-lg mb-1">${challenge.title}</div>
                    <div class="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        ${challenge.points}/50 pts
                    </div>
                    <div class="font-italic text-xs text-gray-600 mb-2">
                        <i>running from ${challenge.start} to ${challenge.end}</i>
                    </div>
                    <div class="text-gray-600 text-sm">${shortDesc}</div>
                </div>
            </li>
        `;
}
function openDetailView(challenge) {
    const detailView = document.getElementById('challenge-detail-view');
    const contentArea = document.getElementById('detail-content');
    
    if (!detailView || !contentArea) return;

    // Populate content
    contentArea.innerHTML = `
        <div class="animate-fade-in">
            <h2 class="text-3xl font-bold text-gray-800 mb-4">${challenge.title}</h2>
            
            <div class="flex items-center gap-4 mb-6">
                <span class="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full">
                    +${challenge.points} Points
                </span>
                <span class="text-gray-600 text-sm">
                    From ${challenge.start} to ${challenge.end}
                </span>
            </div>

            <div class="prose max-w-none text-gray-700 mb-8">
                <h3 class="text-xl font-semibold mb-2">Full Description</h3>
                <p class="leading-relaxed">${challenge.description}</p>
            </div>

            <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">Challenge Details</h3>
                <p class="text-gray-600 italic">This is a placeholder for detailed instructions, rules, and submission guidelines.</p>
                <div class="mt-4 flex gap-2">
                    <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Start Challenge</button>
                    <button class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 text-sm">View Rules</button>
                </div>
            </div>
        </div>
    `;

    // Slide in
    detailView.classList.add('active');

    const backBtn = document.getElementById('challenges-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', closeDetailView);
    }
}

function closeDetailView() {
    const detailView = document.getElementById('challenge-detail-view');
    if (detailView) {
        detailView.classList.remove('active');
    }
}