import { fetchActiveChallengeData, fetchChallengeProgress } from "./data-fetcher.js";

export function initChallenges(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for challenges");
        return;
    }

    fetchAndRenderChallenges(supabaseClient);
}

export async function fetchAndRenderChallenges(supabaseClient) {
    const challenge = await fetchActiveChallengeData(supabaseClient);
    const currentHouseId = (await supabaseClient.auth.getUser()).data.user.id
    const challengeProgress = await fetchChallengeProgress(supabaseClient, challenge.id, currentHouseId)
    renderChallenge(challenge, challengeProgress[0].points ?? 0);

    const showMoreBtn = document.getElementById('show-more-btn')
    if(showMoreBtn){
        showMoreBtn.addEventListener('click', () => openDetailView(challenge, challengeProgress[0]))
    }
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
                        ${currentPoints}/${challenge.id == 7 ? "25" : "50"} punten
                    </div>
                    <div class="font-italic text-xs text-gray-600 mb-2">
                        <i>Loopt van ${challenge.start} tot ${challenge.end}</i>
                    </div>
                    <div class="text-gray-600 text-sm">${shortDesc}</div>
                </div>
            </li>
        `;
}

function openDetailView(challenge, challengeProgressObject) {
    const detailView = document.getElementById('challenge-detail-view');
    const contentArea = document.getElementById('detail-content');
    
    if (!detailView || !contentArea) return;

    

    const challengeProgressAllHouses = challenge.challenge_progress_all_houses

    const currentHouseName = "Testhouse-Reusel"
    const currentHouseGeneralData = challengeProgressAllHouses[currentHouseName]

    // Populate content
    let html = `
        <div class="animate-fade-in">
            <h2 class="text-3xl font-bold text-gray-800 mb-4">${challenge.title}</h2>
            
            <div class="flex items-center gap-4 mb-6">
                <span class="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full">
                    +${challengeProgressObject.points} Points
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
    if (Object.keys(challengeProgressObject).length > 0) {
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
        
        for (const [date, data] of Object.entries(challengeProgressObject.challenge_progress)) {
            const feedbackIcon = getFeedbackIcon(data.feedback);
            html += `
                <tr>
                    <td class="font-medium">${data.day}</td>
                    <td>${date}</td>
                    <td>${data.expected}</td>
                    <td>${data.actual ?? "-"}</td>
                    <td>${data.difference ?? "-"}</td>
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
                        <div class="text-sm text-gray-600 mb-1">Combined Expected Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.expected}</div>
                    </div>
                    <div class="bg-green-50 rounded-lg p-4">
                        <div class="text-sm text-gray-600 mb-1">Combined Actual Usage</div>
                        <div class="text-xl font-bold text-gray-800">${currentHouseGeneralData.actual}</div>
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
    const rawData = Object.entries(housesData).map(([name, data]) => ({
        name,
        value: parseFloat(data.difference) || 0
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
    const minVal = Math.min(...sortedData.map(d => d.value), -100);
    const maxVal = Math.max(...sortedData.map(d => d.value), 5);
    
    // --- MODIFICATION 2: Dynamic Zero Line ---
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
    const x5 = zeroX + (5 * scale);
    ctx.beginPath();
    ctx.moveTo(x5, padding.top);
    ctx.lineTo(x5, padding.top + chartHeight);
    ctx.strokeStyle = '#ef4444'; 
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