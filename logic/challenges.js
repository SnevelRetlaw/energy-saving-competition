import { fetchCurrentHouseName, fetchActiveOrLastChallengeData, fetchChallengeProgress, fetchActiveAndFinishedChallengesData } from "./data-fetcher.js";

let availableChallenges = []
let availableProgressObjects = []
let currentChallengeIndex = 0
let currentHouseName = ""
let currentHouseId = ""
const CHALLENGE_1_ID = 6
const CHALLENGE_2_ID = 7
const CHALLENGE_3_ID = 8
const CHALLENGE_4_ID = 9

export async function initChallenges(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for challenges");
        return;
    }
    currentHouseId = (await supabaseClient.auth.getUser()).data.user.id
    currentHouseName = await fetchCurrentHouseName(supabaseClient, currentHouseId)
    await fetchAndRenderChallenges(supabaseClient);
}

export async function fetchAndRenderChallenges(supabaseClient) {
    const challenge = await fetchActiveOrLastChallengeData(supabaseClient);
    if (!challenge) {
        renderEmptyState()
        return
    }

    const challengeProgress = await fetchChallengeProgress(supabaseClient, [challenge.id], currentHouseId)
    const currentpoints = challengeProgress[0] ? challengeProgress[0].points : 0 
    renderChallenge(challenge, currentpoints);

    const showMoreBtn = document.getElementById('show-more-btn')
    if(showMoreBtn){
        showMoreBtn.addEventListener('click', () => fetchAndRenderDetailedChallenges(supabaseClient))
    }
}

function linkify(text) {
  const urlRegex = /\b(https?:\/\/[^\s<>"']+)/gi;

  return text.replace(urlRegex, (match) => {
    // Strip trailing punctuation
    let cleanUrl = match.replace(/[.,;:!?)'"\\]]+$/, '');
    
    // Create the link string directly without internal newlines
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${cleanUrl}</a>`;
  });
}

async function fetchAndRenderDetailedChallenges(supabaseClient){
    const allChallenges = await fetchActiveAndFinishedChallengesData(supabaseClient)
    availableChallenges = allChallenges || []
    currentChallengeIndex = availableChallenges.length - 1

    const allChallengeIds = allChallenges.map(challenge => challenge.id)
    const allChallengeProgresses = await fetchChallengeProgress(supabaseClient, allChallengeIds, currentHouseId)
    availableProgressObjects = allChallengeProgresses || []
    const currentChallengeProgress = getCorrectChallengeProgress()

    if (availableChallenges.length > 0){
        openDetailView(availableChallenges[currentChallengeIndex], currentChallengeProgress, currentHouseName)
    } else {
        renderEmptyState()
        closeDetailView()
    }
}

function getCorrectChallengeProgress(){
    const challenge = availableChallenges[currentChallengeIndex]
    const challengeID = challenge.id
    for(const challengeProgress of availableProgressObjects){
        if (challengeID == challengeProgress.challenge_id) return challengeProgress
    }
    return null
}

function nextPage(){
    if (currentChallengeIndex === availableChallenges.length -1) return

    currentChallengeIndex = currentChallengeIndex + 1
    openDetailView(availableChallenges[currentChallengeIndex], getCorrectChallengeProgress(), currentHouseName)
}
window.handleChallengeNavNext = async () => {
    await nextPage()
}

function previousPage(){
    if (currentChallengeIndex === 0) return

    currentChallengeIndex = currentChallengeIndex - 1
    openDetailView(availableChallenges[currentChallengeIndex], getCorrectChallengeProgress(), currentHouseName)
}
window.handleChallengeNavPrev = async () => {
    await previousPage()
}

function renderChallenge(challenge, currentPoints) {
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
                        ${currentPoints}/${challenge.id == CHALLENGE_2_ID ? "25" : "50"} punten
                    </div>
                    <div class="font-italic text-xs text-gray-600 mb-2">
                        <i>Loopt van ${challenge.start} tot ${challenge.end}</i>
                    </div>
                    <div class="text-gray-600 text-sm">${shortDesc}</div>
                </div>
            </li>
        `;
}

function openDetailView(challenge, challengeProgressObject, currentHouseName) {
    const detailView = document.getElementById('challenge-detail-view');
    const contentArea = document.getElementById('detail-content');
    
    if (!detailView || !contentArea) return;

    const showGasView = challenge.id === CHALLENGE_3_ID
    
    const challengeProgressAllHouses = challenge.challenge_progress_all_houses

    const currentHouseGeneralData = challengeProgressAllHouses ? challengeProgressAllHouses[currentHouseName] : null

    // Populate content
    let html = `
        <div class="animate-fade-in">

            <div class="flex justify-between items-center mb-4">
                <h2 class="text-3xl font-bold text-gray-800 mb-4">${challenge.title}</h2>
                <span class="text-sm text-gray-500">
                    ${currentChallengeIndex + 1} of ${availableChallenges.length}
                </span>
            </div>
            
            <div class="flex items-center gap-4 mb-6">
                <span class="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full">
                    +${challengeProgressObject ? challengeProgressObject.points : 0} Points
                </span>
                <span class="text-gray-600 text-sm">
                    From ${challenge.start} to ${challenge.end}
                </span>
            </div>

            <div class="prose max-w-none text-gray-700 mb-8">
                <h3 class="text-xl font-semibold mb-2">Description</h3>
                <p class="leading-relaxed whitespace-pre-wrap">${challenge.description}</p>
            </div>
        </div>
    `;

    // Daily Progress Table
    if (challengeProgressObject && Object.keys(challengeProgressObject).length > 0) {
        html += `
            <div class="mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Daily Progress</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Date</th>
                                <th>Baseline</th>
                                ${challenge.id === CHALLENGE_4_ID ? '' : '<th>Expected</th>'}
                                <th>Actual</th>
                                <th>Feedback</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        for (const [date, data] of Object.entries(challengeProgressObject.challenge_progress)) {
            const feedbackIcon = getFeedbackIcon(data.feedback);
            html += `
                <tr>
                    <td class="font-medium">${data.day}</td>
                    <td>${date}</td>
                    <td>${data.baseline.toFixed(2)} ${showGasView ? "m³" : "kWh"}</td>
                    ${challenge.id === CHALLENGE_4_ID ? '' : `<td>${data.expected.toFixed(2)} ${showGasView ? "m³" : "kWh"} (${data.expected_difference}%)</td>`}
                    <td>${data.actual ? data.actual.toFixed(2) : "-"} ${showGasView ? "m³" : "kWh"} (${data.actual_difference ? data.actual_difference.toFixed(2) : '-'}%)</td>
                    <td>${feedbackIcon ?? "-"}</td>
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
                        <div class="text-sm text-gray-600 mb-1">Combined baseline Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.baseline.toFixed(2)} ${showGasView ? "m³" : "kWh"}</div>
                    </div>
                    ${challenge.id === CHALLENGE_4_ID ? '' : `
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Combined expected Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.expected.toFixed(2)} ${showGasView ? "m³" : "kWh"} (${currentHouseGeneralData.expected_difference}%)</div>
                    </div>`}
                    <div class="bg-purple-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Combined Actual Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.actual.toFixed(2)} ${showGasView ? "m³" : "kWh"} (${currentHouseGeneralData.actual_difference.toFixed(2)}%)</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (challengeProgressAllHouses && Object.keys(challengeProgressAllHouses).length > 1) {
        html += `
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Performance Comparison</h3>
                <div class="relative w-full h-64 bg-white border border-gray-200 rounded-lg p-4">
                    <canvas id="comparisonChart" class="w-full h-full"></canvas>
                </div>
            </div>
        `;
    }

    if (availableChallenges.length > 1){
        html += `
            <div class="flex justify-between mt-8 pt-6 border-t">
                <button onclick="window.handleChallengeNavPrev()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 ${currentChallengeIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                    ← Previous
                </button>
                <button onclick="window.handleChallengeNavNext()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 ${currentChallengeIndex === availableChallenges.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                    Next →
                </button>
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

    if (challengeProgressAllHouses && Object.keys(challengeProgressAllHouses).length > 1) {
        setTimeout(() => {
            renderComparisonChart(challengeProgressAllHouses, currentHouseName);
        }, 100);
    }
}

function closeDetailView() {
    currentChallengeIndex = 0
    const detailView = document.getElementById('challenge-detail-view');
    if (detailView) {
        detailView.classList.remove('active');
    }
}

function renderEmptyState() {
    const challengeContent = document.getElementById("challenges-list")
    challengeContent.innerHTML = `
        <div class="empty-state">
            <p>No active challenge available today</p>
        </div>
    `;
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
    if (currentHouseName !== "Demo Huis"){
        delete housesData["Demo Huis"]
    }
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
    const rawData = Object.entries(housesData).map(([name, data]) => ({
        name,
        value: parseFloat(data.actual_difference) || 0
    }));

    // Sort by value (ascending: most negative first)
    const sortedData = rawData.sort((a, b) => a.value - b.value);

    // Calculate dynamic dimensions
    const padding = { 
        top: 20, 
        right: 30, 
        bottom: 20, 
        left: 120 // Safe zone for labels
    };
    
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;
    
    const barHeight = Math.max(20, (chartHeight / sortedData.length) - 10);
    
    // Find min/max values for dynamic scaling
    const minVal = Math.min(...sortedData.map(d => d.value), -10);
    const maxVal = Math.max(...sortedData.map(d => d.value), 5);
    
    const totalRange = maxVal - minVal;
    const zeroOffsetPixels = ((0 - minVal) / totalRange) * chartWidth;
    const zeroX = padding.left + zeroOffsetPixels;
    const scale = chartWidth / totalRange;

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw zero line
    ctx.beginPath();
    ctx.moveTo(zeroX, padding.top);
    ctx.lineTo(zeroX, padding.top + chartHeight);
    ctx.strokeStyle = '#6b7280'; 
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Reference Line at 5%
    const expected_difference = housesData[currentHouseName].expected_difference
    const x5 = zeroX + (expected_difference * scale);
    ctx.beginPath();
    ctx.moveTo(x5, padding.top - 12);
    ctx.lineTo(x5, padding.top + chartHeight);
    ctx.strokeStyle = '#ef4444'; 
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Label for Reference Line
    ctx.fillStyle = '#ef4444';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Target: ${expected_difference}%`, x5 + 5, padding.top - 8);

    // Draw Bars
    sortedData.forEach((item, index) => {
        const y = padding.top + (index * (barHeight + 10)) + (barHeight / 2);
        const barWidth = Math.abs(item.value) * scale;
        
        // Round value to 2 decimal places
        const roundedValue = Math.round(item.value * 100) / 100;
        const valueLabel = `${roundedValue}%`;
        
        // Determine color
        const isCurrent = item.name === currentHouseName;
        ctx.fillStyle = isCurrent ? '#3b82f6' : '#9ace00'; 
        
        // Draw bar anchored at zero line
        let barStartX;
        let barEndX;
        
        if (item.value >= 0) {
            // Positive: extends Right
            barStartX = zeroX;
            barEndX = zeroX + barWidth;
            ctx.fillRect(barStartX, y - (barHeight/2), barWidth, barHeight);
        } else {
            // Negative: extends Left
            barStartX = zeroX - barWidth;
            barEndX = zeroX;
            ctx.fillRect(barStartX, y - (barHeight/2), barWidth, barHeight);
        }

        // Draw House Name
        ctx.fillStyle = '#31371f';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(item.name, padding.left - 10, y + 4);

        // --- MODIFICATION 1: Internal Labels at the End ---
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        
        let valueX;
        let textAlign;
        let drawInside = false;
        
        if (item.value >= 0) {
            // Positive: label normally at right end
            valueX = barEndX + 5;
            textAlign = 'left';
        } else {
            // Negative: label normally at left end
            valueX = barStartX - 5;
            textAlign = 'right';
            
            // Check if label ends before safe zone
            const textMetrics = ctx.measureText(valueLabel);
            const textWidth = textMetrics.width;
            const labelLeftEdge = valueX - textWidth;
            
            if (labelLeftEdge < padding.left) {
                drawInside = true;
            }
        }
        
        if (drawInside) {
            const centerY = y;
            
            ctx.textAlign = textAlign;
            ctx.textBaseline = 'middle';
            
            const finalX = barStartX + 60;
            
            ctx.fillText(valueLabel, finalX, centerY);
            
            // Reset baseline for next iteration
            ctx.textBaseline = 'alphabetic';
        } else {
            // Standard drawing outside
            ctx.textAlign = textAlign;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(valueLabel, valueX, y + 4);
        }
    });
}