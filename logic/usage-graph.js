import { fetchUsageGraphData } from './data-fetcher.js';

export function initUsageGraph(supabaseClient) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized for Usage graph");
        return;
    }
    fetchAndRenderGraph(supabaseClient);
}

async function fetchAndRenderGraph(supabaseClient) {
    const data = await fetchUsageGraphData(supabaseClient);
    renderGraph(data);
}

function renderGraph(data) {
    const usageGraphContent = document.getElementById('usage-graph-content')
    if (!usageGraphContent) return;

    if (data && data.length > 0) {
        // Placeholder for Chart.js or similar implementation
        usageGraphContent.innerHTML = `<p>Graph rendering logic pending data structure.</p>`;
    } else {
        usageGraphContent.innerHTML = `<p>No usage data recorded yet.</p>`;
    }
}