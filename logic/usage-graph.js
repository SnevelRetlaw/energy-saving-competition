import { fetchUsageGraphData } from './data-fetcher.js';

let allUsageData = [];
let availableDates = [];
let currentDateIndex = 0;
let currentChart = null;
let currentDataType = 'electricity'; // 'electricity' or 'gas'
let supabaseClientGlob = null;

export function initUsageGraph(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for Usage graph");
        return;
    }
    supabaseClientGlob = supabaseClient;

    loadAllData();
    
    // Setup type switching
    const elecBtn = document.getElementById('graph-type-elec');
    const gasBtn = document.getElementById('graph-type-gas');

    if (elecBtn) elecBtn.onclick = () => { 
        currentDataType = 'electricity'; 
        updateControlButtons(); 
        loadInitialData(); 
    };
    if (gasBtn) gasBtn.onclick = () => { 
        currentDataType = 'gas'; 
        updateControlButtons(); 
        loadInitialData(); 
    };

    setupNavigation();
}

function setupNavigation() {
    const prevBtn = document.getElementById('graph-nav-prev');
    const nextBtn = document.getElementById('graph-nav-next');
    const dateDisplay = document.getElementById('graph-date-display');

    if (prevBtn) {
        prevBtn.onclick = () => navigateDate(-1);
    }
    if (nextBtn) {
        nextBtn.onclick = () => navigateDate(1);
    }
}

function navigateDate(direction) {
    if (availableDates.length === 0) return;

    const newIndex = currentDateIndex + direction;
    
    
    if (newIndex < 0 || newIndex >= availableDates.length){
        return;
    }

    currentDateIndex = newIndex;
    updateNavigationUI();
    renderCurrentDate();
}

function updateNavigationUI() {
    const prevBtn = document.getElementById('graph-nav-prev');
    const nextBtn = document.getElementById('graph-nav-next');
    const dateDisplay = document.getElementById('graph-date-display');

    if (prevBtn) {
        prevBtn.disabled = currentDateIndex === 0;
        prevBtn.classList.toggle('opacity-50', currentDateIndex === 0);
        prevBtn.classList.toggle('cursor-not-allowed', currentDateIndex === 0);
    }

    if (nextBtn) {
        nextBtn.disabled = currentDateIndex === availableDates.length - 1;
        nextBtn.classList.toggle('opacity-50', currentDateIndex === availableDates.length - 1);
        nextBtn.classList.toggle('cursor-not-allowed', currentDateIndex === availableDates.length - 1);
    }

    if (dateDisplay && availableDates.length > 0) {
        const dateStr = availableDates[currentDateIndex];
        const dateObj = new Date(dateStr);
        dateDisplay.textContent = dateObj.toLocaleDateString('en-US', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    }
}

function updateControlButtons() {
    const elecBtn = document.getElementById('graph-type-elec');
    const gasBtn = document.getElementById('graph-type-gas');
    if (elecBtn) elecBtn.classList.toggle('active', currentDataType === 'electricity');
    if (gasBtn) gasBtn.classList.toggle('active', currentDataType === 'gas');
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

    if (availableDates.length === 0) {
        updateEmptyState("No valid dates found in data.");
        return;
    }

    currentDateIndex = availableDates.length - 1;
    
    updateNavigationUI();
    renderCurrentDate();
}

async function renderCurrentDate() {
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

function renderChart(labels, values, dataType, dateLabel) {
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
    const isElectricity = dataType === 'electricity';
    const unit = isElectricity ? 'kWh' : 'm³';
    const color = isElectricity ? '#3b82f6' : '#22c55e';
    const label = isElectricity ? 'Electricity Consumption' : 'Gas Consumption';

    currentChart = new Chart(ctx, {
        type: 'line',
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
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toFixed(2)} ${unit}`,
                        title: (items) => {
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
                        maxTicksLimit: 24,
                        maxRotation: 0,
                        minRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 10
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