import { fetchUsageGraphData } from './data-fetcher.js';

let allUsageData = [];
let availableDates = [];
let availableMonths = [];
let currentDateIndex = 0;
let currentChart = null;
let currentDataType = 'electricity'; // 'electricity' or 'gas'
let currentViewMode = 'daily'; // 'daily' or 'monthly
let supabaseClientGlob = null;

export function initUsageGraph(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for Usage graph");
        return;
    }
    supabaseClientGlob = supabaseClient;

    loadAllData();
    
    const elecBtn = document.getElementById('graph-type-elec');
    const gasBtn = document.getElementById('graph-type-gas');

    if (elecBtn) elecBtn.onclick = () => { 
        currentDataType = 'electricity'; 
        updateControlButtons(); 
        loadAllData(); 
    };
    if (gasBtn) gasBtn.onclick = () => { 
        currentDataType = 'gas'; 
        updateControlButtons(); 
        loadAllData(); 
    };

    const dailyBtn = document.getElementById('graph-view-daily');
    const monthlyBtn = document.getElementById('graph-view-monthly');

    if (dailyBtn) dailyBtn.onclick = () => {
        currentViewMode = 'daily';
        updateViewButtons();
        // Reset to most recent date
        currentDateIndex = availableDates.length > 0 ? availableDates.length - 1 : 0;
        updateNavigationUI()
        renderCurrentView();
    };
    if (monthlyBtn) monthlyBtn.onclick = () => {
        currentViewMode = 'monthly';
        updateViewButtons();
        // Reset to most recent month
        currentDateIndex = availableMonths.length > 0 ? availableMonths.length - 1 : 0;
        updateNavigationUI()
        renderCurrentView();
    };

    setupNavigation();
}

function setupNavigation() {
    const prevBtn = document.getElementById('graph-nav-prev');
    const nextBtn = document.getElementById('graph-nav-next');
    const dateDisplay = document.getElementById('graph-date-display');

    if (prevBtn) {
        prevBtn.onclick = () => navigateView(-1);
    }
    if (nextBtn) {
        nextBtn.onclick = () => navigateView(1);
    }
}

function navigateView(direction) {
    if (currentViewMode === 'daily') {
        if (availableDates.length === 0) return;
        const newIndex = currentDateIndex + direction;
        if (newIndex < 0 || newIndex >= availableDates.length) return;
        currentDateIndex = newIndex;
    } else {
        if (availableMonths.length === 0) return;
        const newIndex = currentDateIndex + direction;
        if (newIndex < 0 || newIndex >= availableMonths.length) return;
        currentDateIndex = newIndex;
    }

    updateNavigationUI();
    renderCurrentView();
}

function updateNavigationUI() {
    const prevBtn = document.getElementById('graph-nav-prev');
    const nextBtn = document.getElementById('graph-nav-next');
    const dateDisplay = document.getElementById('graph-date-display');

    let isDisabledPrev = currentDateIndex === 0;
    let isDisabledNext = false;
    let displayText = "Loading...";

    if (currentViewMode === 'daily') {
        isDisabledNext = currentDateIndex === availableDates.length - 1;
        
        if (availableDates.length > 0) {
            const dateStr = availableDates[currentDateIndex];
            const dateObj = new Date(dateStr);
            displayText = dateObj.toLocaleDateString('en-US', { 
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' 
            });
        }
    } else {
        // Monthly View
        isDisabledNext = currentDateIndex === availableMonths.length - 1;
        if (availableMonths.length > 0) {
            const monthStr = availableMonths[currentDateIndex]; // YYYY-MM
            const [year, month] = monthStr.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            // Format: "April 2026"
            displayText = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    }

    if (prevBtn) {
        prevBtn.disabled = isDisabledPrev;
        prevBtn.classList.toggle('opacity-50', isDisabledPrev);
        prevBtn.classList.toggle('cursor-not-allowed', isDisabledPrev);
    }

    if (nextBtn) {
        nextBtn.disabled = isDisabledNext;
        nextBtn.classList.toggle('opacity-50', isDisabledNext);
        nextBtn.classList.toggle('cursor-not-allowed', isDisabledNext);
    }

    if (dateDisplay) {
        dateDisplay.textContent = displayText;
    }
}

function updateControlButtons() {
    const elecBtn = document.getElementById('graph-type-elec');
    const gasBtn = document.getElementById('graph-type-gas');
    if (elecBtn) elecBtn.classList.toggle('active', currentDataType === 'electricity');
    if (gasBtn) gasBtn.classList.toggle('active', currentDataType === 'gas');
}

function updateViewButtons() {
    const dailyBtn = document.getElementById('graph-view-daily');
    const monthlyBtn = document.getElementById('graph-view-monthly');
    if (dailyBtn) dailyBtn.classList.toggle('active', currentViewMode === 'daily');
    if (monthlyBtn) monthlyBtn.classList.toggle('active', currentViewMode === 'monthly');
}

function updateEmptyState(msg) {
    const container = document.getElementById('usage-graph-content');
    if (container) {
        container.innerHTML = `<p class="text-center text-gray-500 py-8">${msg}</p>`;
    }
}

function parseDutchNumber(str) {
    if (!str && str !== 0) return 0.0;
    const cleanStr = String(str)
        .replace(/\./g, '')      // Remove thousands separators (dots)
        .replace(',', '.');      // Replace decimal comma with dot
    return parseFloat(cleanStr) || 0.0;
};

async function loadAllData() {
    const rawData = await fetchUsageGraphData(supabaseClientGlob);

    if (!rawData || rawData.length === 0) {
        updateEmptyState("No usage data available in the system.");
        return;
    }

    allUsageData = rawData;
    
    const dateSet = new Set(allUsageData.map(d => d.date));
    availableDates = Array.from(dateSet).sort();

    const monthSet = new Set();
    availableDates.forEach(dateStr => {
        // dateStr is YYYY-MM-DD
        const parts = dateStr.split('-');
        if (parts.length >= 2) {
            monthSet.add(`${parts[0]}-${parts[1]}`);
        }
    });
    availableMonths = Array.from(monthSet).sort();

    if (availableDates.length === 0) {
        updateEmptyState("No valid dates found in data.");
        return;
    }

    currentDateIndex = currentViewMode === "daily" ? availableDates.length - 1: availableMonths.length -1;
    
    updateViewButtons();
    updateNavigationUI();
    renderCurrentView();
}

function renderCurrentView() {
    if (currentViewMode === 'daily') {
        renderDailyView();
    } else {
        renderMonthlyView();
    }
}

async function renderDailyView() {
    if (availableDates.length === 0) return;

    const targetDate = availableDates[currentDateIndex];
    const targetDateData = allUsageData.filter(d => d.date === targetDate)

    if (!targetDateData || targetDateData.length === 0) {
        updateEmptyState(`No usage data available for ${targetDate}.`);
        return;
    }
    const labels = []; 
    const values = [];

    targetDateData.forEach(row => {
        const usages = currentDataType === "electricity" ? row.raw_elec_data?.usages : row.raw_gas_data?.usages;
        
        usages.forEach(usage => {
            if (!usage.time) return;

            let timeObj = usage.time;
            let timeLabel = timeObj.split(/(\s+)/)[2].slice(0,-3)

            let val = 0.0;

            if (currentDataType === 'electricity') {
                const dLow = parseDutchNumber(usage.delivery_low);
                const dHigh = parseDutchNumber(usage.delivery_high);
                const rLow = parseDutchNumber(usage.returned_delivery_low);
                const rHigh = parseDutchNumber(usage.returned_delivery_high);
                
                val = (dLow + dHigh) - (rLow + rHigh);
            } else {
                const delivery = parseDutchNumber(usage.delivery);
                val = delivery;
            }

            labels.push(timeLabel);
            values.push(val);
        });
    });

    if (labels.length === 0) {
        updateEmptyState(`No data points found for ${targetDate}.`);
        return;
    }

    renderChart(labels, values, currentDataType, targetDate);
}

function renderMonthlyView() {
    if (availableMonths.length === 0) return;

    const targetMonth = availableMonths[currentDateIndex];
    const [year, month] = targetMonth.split('-');
    
    const dailyTotals = {};
    
    // Initialize all days in the month to 0
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayStr = `${year}-${month}-${String(i).padStart(2, '0')}`;
        dailyTotals[dayStr] = 0;
    }

    const monthData = allUsageData.filter(d => d.date.startsWith(targetMonth));
    
    monthData.forEach(row => {
        const dateKey = row.date;
        const usages = currentDataType === "electricity" ? row.raw_elec_data?.usages : row.raw_gas_data?.usages;
        if (!usages) return;

        let dayTotal = 0;
        usages.forEach(usage => {
            dayTotal += calculateValue(usage);
        });
        
        if (dailyTotals.hasOwnProperty(dateKey)) {
            dailyTotals[dateKey] += dayTotal;
        }
    });

    const labels = [];
    const values = [];

    Object.keys(dailyTotals).forEach(dateKey => {        
        const dayNum = parseInt(dateKey.split('-')[2]);
        labels.push(dayNum.toString()); // Just the day number
        values.push(dailyTotals[dateKey]);
    });

    if (values.length === 0) {
        updateEmptyState(`No data found for ${targetMonth}.`);
        return;
    }

    renderChart(labels, values, `${month}/${year}`, 'day');
}

function calculateValue(usage) {
    if (currentDataType === 'electricity') {
        const dLow = parseDutchNumber(usage.delivery_low);
        const dHigh = parseDutchNumber(usage.delivery_high);
        const rLow = parseDutchNumber(usage.returned_delivery_low);
        const rHigh = parseDutchNumber(usage.returned_delivery_high);
        return (dLow + dHigh) - (rLow + rHigh);
    } else {
        return parseDutchNumber(usage.delivery);
    }
}

function renderChart(labels, values, labelSuffix, xAxisType) {
    const container = document.getElementById('usage-graph-content');
    if (!container) return;

    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'usageChart';
    canvas.className = 'w-full h-64';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const isElectricity = currentDataType === 'electricity';
    const unit = isElectricity ? 'kWh' : 'm³';
    const color = isElectricity ? '#3b82f6' : '#22c55e';
    const label = isElectricity ? 'Electricity Consumption' : 'Gas Consumption';

    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${label} (${labelSuffix})`,
                data: values,
                borderColor: color,
                backgroundColor: isElectricity ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toFixed(2)} ${unit}`,
                        title: (items) => {
                            if (xAxisType === 'day') {
                                return `Day ${items[0].label}`;
                            }
                            return items[0].label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (val) => val.toFixed(2) + ' ' + unit
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: xAxisType === 'day' ? 31 : 24,
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 5
                    }
                }
            }
        }
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getChartConfig(labels, values, dateLabel) {
    const isElectricity = currentDataType === 'electricity';
    const unit = isElectricity ? 'kWh' : 'm³';
    const color = isElectricity ? '#3b82f6' : '#22c55e';
    const label = isElectricity ? 'Net Electricity Consumption' : 'Gas Consumption';

    return {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `${label} (${dateLabel})`,
                data: values,
                borderColor: color,
                backgroundColor: isElectricity ? 'rgba(59, 130, 246, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(2)} ${unit}`;
                        },
                        title: function(context) {
                            return context[0].parsed.x; // Show time in tooltip title
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    ticks: {
                        maxTicksLimit: 24, // Limit to roughly hourly intervals
                        maxRotation: 45,
                        minRotation: 45,
                        callback: function(value, index) {
                            // Only show labels for every Nth point to avoid overcrowding
                            // Adjust divisor based on number of points
                            const divisor = Math.ceil(values.length / 12);
                            return index % divisor === 0 ? value : '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if(isElectricity){
                                return value.toFixed(1) + ' ' + unit;
                            }
                            return value.toFixed(2) + ' ' + unit;
                        }
                    },
                    title: {
                        display: true,
                        text: `Consumption (${unit})`
                    }
                }
            }
        }
    };
}