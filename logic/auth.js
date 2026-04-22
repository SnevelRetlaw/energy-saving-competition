import { fetchDashboardData } from "./data-fetcher.js";
import { fetchAndRenderChallenges } from "./challenges.js";
import { fetchAndRenderDailyEnergyInsight } from "./daily-energy-insight.js";
import { fetchAndRenderLeaderboard } from "./leaderboard.js";
import { fetchAndRenderGraph } from "./usage-graph.js";

let supabaseClient = null;
let currentUser = null;

/**
 * Initializes the authentication module.
 * Must be called after supabaseClient is created in index.html.
 */
export function initAuth(client) {
    supabaseClient = client;
    
    // Check for existing session on load
    checkSession();

    // Listen for auth changes (login/logout)
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            showDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            flushData();
            showLogin();
        }
    });
}

/**
 * Checks if a user is already logged in
 */
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
    } else {
        showLogin();
    }
}

/**
 * Handles the login form submission
 */
export async function handleLogin(email, password) {
    if (!supabaseClient) {
        console.error("Supabase client not initialized");
        return { error: "System not ready" };
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // Optional: Verify the user exists in the Participants table
        // This ensures the 1-to-1 mapping logic holds
        const { data: participant, error: partError } = await supabaseClient
            .from('Participants')
            .select('*')
            .eq('auth_user_id', data.user.id)
            .single();

        if (partError || !participant) {
            // Sign out if the user exists in Auth but not linked to a Participant
            await supabaseClient.auth.signOut();
            return { error: "Account not linked to a house. Please contact support." };
        }

        return { success: true, participant };
    } catch (err) {
        return { error: err.message };
    }
}

/**
 * Handles logout
 */
export async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    flushData();
    showLogin();
}

function flushData() {
    currentUser = null;

    const challengesList = document.getElementById('challenges-list');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const dailyEnergyInsight = document.getElementById('daily-energy-insight-content')
    const usageGraphContent = document.getElementById('usage-graph-content')


    if (challengesList) {
        challengesList.innerHTML = '<li class="text-center py-4 empty-state">Loading...</li>';
    }

    if (leaderboardBody) {
        leaderboardBody.innerHTML = '<tr><td colspan="3" class="text-center py-4 empty-state">Loading...</td></tr>';
    }

    if (dailyEnergyInsight) {
        dailyEnergyInsight.innerHTML = '<div class="text-center py-4 empty-state">Loading...<div>'
    }

    if (usageGraphContent) {
        usageGraphContent.innerHTML = '<div class="text-center py-4 empty-state">Loading...<div>'
    }

    // Optionally clear any other dynamic content or cached data here
    // For example, if you store data in localStorage:
    // localStorage.clear();
}

/**
 * UI Toggle Functions
 */
function showLogin() {
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('dashboard-content').style.display = 'none';
    document.getElementById('user-info-bar').classList.remove('active');
}

async function showDashboard() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('dashboard-content').style.display = 'block';
    
    // Update user info bar
    const userInfoBar = document.getElementById('user-info-bar');
    const userEmailSpan = document.getElementById('user-email-display');
    
    if (currentUser && userEmailSpan) {
        userEmailSpan.textContent = currentUser.email;
        userInfoBar.classList.add('active');


        await fetchAndRenderChallenges(supabaseClient)
        await fetchAndRenderDailyEnergyInsight(supabaseClient)
        await fetchAndRenderGraph(supabaseClient)
        await fetchAndRenderLeaderboard(supabaseClient)
    }
}

// Expose functions to global scope for HTML onclick handlers
window.handleLoginSubmit = async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');
    const submitBtn = document.querySelector('.login-btn');

    if (!emailInput.value || !passwordInput.value) {
        errorMsg.textContent = "Please enter both email and password.";
        errorMsg.style.display = 'block';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    errorMsg.style.display = 'none';

    const result = await handleLogin(emailInput.value, passwordInput.value);

    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";

    if (result.error) {
        errorMsg.textContent = result.error;
        errorMsg.style.display = 'block';
    } else {
        // Success is handled by onAuthStateChange listener
        // Clear inputs
        emailInput.value = '';
        passwordInput.value = '';
    }
};

window.handleLogoutClick = handleLogout;