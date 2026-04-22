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
    // console.log(challenge)
    const detailView = document.getElementById('challenge-detail-view');
    const contentArea = document.getElementById('detail-content');
    
    if (!detailView || !contentArea) return;

    const challengeProgress = challenge.challenge_progress
    const challengeProgressAllHouses = challenge.challenge_progress_all_houses

    const currentHouseName = "house_name_1"
    const currentHouseGeneralData = challengeProgressAllHouses[currentHouseName]

    // Populate content
    let html = `
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
                <h3 class="text-xl font-semibold mb-2">Description</h3>
                <p class="leading-relaxed">${challenge.description}</p>
            </div>
        </div>
    `;

    // Daily Progress Table
    if (Object.keys(challengeProgress).length > 0) {
        html += `
            <div class="mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Daily Progress</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Date</th>
                                <th>Expected</th>
                                <th>Actual</th>
                                <th>Difference</th>
                                <th>Feedback</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        for (const [day, data] of Object.entries(challengeProgress)) {
            const feedbackIcon = getFeedbackIcon(data.feedback);
            html += `
                <tr>
                    <td class="font-medium">${day}</td>
                    <td>${data.date}</td>
                    <td>${data.expected}</td>
                    <td>${data.actual}</td>
                    <td>${data.difference}</td>
                    <td>${feedbackIcon}</td>
                </tr>
            `;
        }        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    if (currentHouseGeneralData) {
        html += `
            <div class="mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Your House Combined Progress</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Combined Expected Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.combined_expected}</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Combined Actual Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.combined_actual}</div>
                    </div>
                    <div class="bg-purple-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Difference</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.difference}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (Object.keys(challengeProgressAllHouses).length > 1) {
        html += `
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Performance Comparison</h3>
                <div class="relative w-full h-64 bg-white border border-gray-200 rounded-lg p-4">
                    <canvas id="comparisonChart" class="w-full h-full"></canvas>
                </div>
            </div>
        `;
    }

    contentArea.innerHTML = html
    // Slide in
    detailView.classList.add('active');

    const backBtn = document.getElementById('challenges-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', closeDetailView);
    }

    if (Object.keys(challengeProgressAllHouses).length > 1) {
        setTimeout(() => {
            renderComparisonChart(challengeProgressAllHouses, currentHouseName);
        }, 100);
    }
}

function closeDetailView() {
    const detailView = document.getElementById('challenge-detail-view');
    if (detailView) {
        detailView.classList.remove('active');
    }
}

function getFeedbackIcon(feedback) {
    const feedbackNum = parseInt(feedback);
    switch (feedbackNum) {
        case -1:
            return '<span title="Below target">😞</span>';
        case 0:
            return '<span title="On target">😐</span>';
        case 1:
            return '<span title="Above target">😊</span>';
        default:
            return '<span title="Unknown">-</span>';
    }
}

function renderComparisonChart(housesData, currentHouseName) {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Handle High DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Prepare Data
    // Convert string percentages to numbers, handle negative signs if any
    const rawData = Object.entries(housesData).map(([name, data]) => ({
        name,
        value: parseFloat(data.difference.replace('%', '')) || 0
    }));

    // Sort by value (ascending: best performance first)
    const sortedData = rawData.sort((a, b) => b.value - a.value);

    const padding = { top: 20, right: 30, bottom: 20, left: 100 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;
    
    const barHeight = Math.max(20, (chartHeight / sortedData.length) - 10);
    const maxVal = Math.max(...sortedData.map(d => d.value), 5); // Ensure 5% is visible
    const scale = chartWidth / (maxVal * 1.1); // 10% buffer

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Reference Line at 5%
    const x5 = padding.left + (5 * scale);
    ctx.beginPath();
    ctx.moveTo(x5, padding.top);
    ctx.lineTo(x5, padding.top + chartHeight);
    ctx.strokeStyle = '#ef4444'; // Red
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Label for Reference Line
    ctx.fillStyle = '#ef4444';
    ctx.font = '12px sans-serif';
    ctx.fillText('5% Target', x5 + 5, padding.top + 12);

    // Draw Bars
    sortedData.forEach((item, index) => {
        const y = padding.top + (index * (barHeight + 10)) + (barHeight / 2);
        const barWidth = item.value * scale;
        const x = padding.left;

        // Determine color: Current house gets special color
        const isCurrent = item.name === currentHouseName;
        ctx.fillStyle = isCurrent ? '#3b82f6' : '#9ace00'; // Blue for current, Gray for others
        
        // Draw Bar
        ctx.fillRect(x, y - (barHeight/2), barWidth, barHeight);

        // Draw House Name (Y-axis)
        ctx.fillStyle = '#31371f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(item.name, x - 10, y + 4);

        // Draw Value (End of bar)
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.value}%`, x + barWidth + 5, y + 4);
    });
}