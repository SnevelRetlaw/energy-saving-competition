import { fetchAvailableDEIs, fetchDEIProgress } from "./data-fetcher.js";

let availableDEIs = []
let availableDEIProgressObjects = []
let currentDEIIndex = 0
let currentHouseId = ""
let supabaseClientGlob = null

export async function initDailyEnergyInsight(supabaseClient) {    
    if (!supabaseClient) {
        console.error("Supabase client not initialized for Daily Energy insight");
        return;
    }

    supabaseClientGlob = supabaseClient
    currentHouseId = (await supabaseClientGlob.auth.getUser()).data.user.id
    await fetchAndRenderDailyEnergyInsight();
}

export async function fetchAndRenderDailyEnergyInsight(){
    currentDEIIndex = 0

    const DEIData = await fetchAvailableDEIs(supabaseClientGlob)
    availableDEIs = DEIData || []

    const currentDEI = availableDEIs[currentDEIIndex]
    const DEIProgressData = (await fetchDEIProgress(supabaseClientGlob, [currentDEI.id], currentHouseId))[0]

    if (availableDEIs.length > 0){
        renderCompactInsight(currentDEI, DEIProgressData.points)
    } else {
        renderEmptyState()
    }
}

export async function fetchAndRenderDetailedDEI(){
    const DEIData = await fetchAvailableDEIs(supabaseClientGlob)
    availableDEIs = DEIData || []

    const availableDEIIds = availableDEIs.map(dei => dei.id)
    const allDEIProgressObjects = await fetchDEIProgress(supabaseClientGlob, availableDEIIds, currentHouseId)
    availableDEIProgressObjects = allDEIProgressObjects || []
    if (availableDEIs.length > 0){
        openInsightDetailView()
    } else {
        renderEmptyState()
        closeInsightDetailView()
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

function nextPage(){
    currentDEIIndex = (currentDEIIndex + 1) % availableDEIs.length
    openInsightDetailView(availableDEIs[currentDEIIndex])
}
window.handleInsightNavNext = async (direction) => {
    await nextPage(direction);
};

function previousPage(){
    currentDEIIndex = (currentDEIIndex - 1) % availableDEIs.length
    openInsightDetailView(availableDEIs[currentDEIIndex])
}
window.handleInsightNavPrev = async (direction) => {
    await previousPage(direction);
};

function renderCompactInsight(energyInsight, points) {
    const deiContent = document.getElementById('daily-energy-insight-content')
    
    deiContent.className = 'energy-insight-content';
    deiContent.innerHTML = `
        <div class="energy-insight-header">
            <h3 class="energy-insight-title">${escapeHtml(energyInsight.title)}</h3>
            <div class="energy-insight-score">
                <span class="score-label">Points:</span>
                <span class="score-value">${points}</span>
            </div>
        </div>
        <div class="energy-insight-info">
            <p class="energy-insight-description">${escapeHtml(energyInsight.information.substring(0, 150))}${energyInsight.information.length > 150 ? '...' : ''}</p>
            <div class="tile-subtext" style="margin-top: 0.5rem;">
                ${formatDate(energyInsight.date)}
            </div>
        </div>
    `;
}

function getCorrectDeiProgress(){
    const DEI = availableDEIs[currentDEIIndex]
    const DEIId = DEI.id
    for(const DEIProgress of availableDEIProgressObjects){
        if (DEIId == DEIProgress.dei_id) return DEIProgress
    }
    return null
}

function openInsightDetailView() {
    const currentDEI = availableDEIs[currentDEIIndex]
    if (!currentDEI) return;

    const currentDEIProgress = getCorrectDeiProgress()
    if (!currentDEIProgress) return;

    const detailView = document.getElementById('insight-detail-view');
    const contentArea = document.getElementById('insight-detail-content');
    
    if (!detailView || !contentArea) return;

    let html = `
        <div class="animate-fade-in">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-3xl font-bold text-gray-800">${escapeHtml(currentDEI.title)}</h2>
                <span class="text-sm text-gray-500">
                    ${currentDEIIndex + 1} of ${availableDEIs.length}
                </span>
            </div>
            
            <div class="flex items-center gap-4 mb-6">
                <span class="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
                    ${currentDEIProgress.points} Points
                </span>
                <span class="text-gray-600 text-sm">
                    ${formatDate(currentDEI.date)}
                </span>
            </div>

            <div class="prose max-w-none text-gray-700 mb-8">
                <h3 class="text-xl font-semibold mb-2">Insight Details</h3>
                <p class="leading-relaxed whitespace-pre-wrap">${linkify(escapeHtml(currentDEI.information))}</p>
            </div>
    `;

    if (currentDEI.quiz) {
        html += `
            <div class="mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-3">Knowledge Check</h3>
                ${renderQuiz()}
            </div>
        `;
    }

    if (currentDEI.activity) {
        html += `
            <div class="mb-8">
                <h3 class="text-lg font-semibold text-gray-700 mb-3 pt-4">Today's Activity</h3>
                <div class="rounded-lg">
                    <p class="text-gray-700">${escapeHtml(currentDEI.activity)}</p>
                </div>
            </div>
        `;
    }

    if (availableDEIs.length > 1) {
        html += `
            <div class="flex justify-between mt-8 pt-6 border-t">
                <button onclick="window.handleInsightNavPrev()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 ${currentDEIIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                    ← Previous
                </button>
                <button onclick="window.handleInsightNavNext()" class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 ${currentDEIIndex === availableDEIs.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}">
                    Next →
                </button>
            </div>
        `;
    }

    html += `</div>`;

    contentArea.innerHTML = html;
    
    // Slide in
    detailView.classList.add('active');
}

function renderQuiz() {
    const currentDEI = availableDEIs[currentDEIIndex]
    const currentDEIProgress = getCorrectDeiProgress()
    let quiz = currentDEI.quiz
    const question = linkify(escapeHtml(quiz.question || ''));
    const correctAnswer = quiz.correct_answer;
    const givenAnswer = currentDEIProgress.given_answer;
    const isCompleted = currentDEIProgress.completed;

    const answers = [
        { key: 'a', value: quiz.answer_a },
        { key: 'b', value: quiz.answer_b },
        { key: 'c', value: quiz.answer_c },
        { key: 'd', value: quiz.answer_d }
    ];

    let optionsHtml = '';

    if (isCompleted) {
        // RENDER LOCKED VIEW: Show Question + Correct Answer Highlighted
        const isCorrect = givenAnswer === correctAnswer;

        optionsHtml = `
            <div class="quiz-options" style="pointer-events: none;">
                ${answers.map(ans => {
                    let styleClass = "option-text";
                    let icon = "";
                    
                    if (ans.key === correctAnswer) {
                        // Correct Answer: Green Background + Checkmark
                        styleClass = "option-text font-bold text-green-800 bg-green-100 border border-green-300 rounded p-2";
                        icon = " ✓";
                    } else if (ans.key === givenAnswer && ans.key !== correctAnswer) {
                        // Incorrect Answer: Red Background + X
                        styleClass = "option-text font-bold text-red-800 bg-red-100 border border-red-300 rounded p-2";
                        icon = " ✗";
                    } else {
                        // Unselected: Greyed out
                        styleClass = "option-text text-gray-400";
                    }

                    return `
                    <div class="quiz-option ${styleClass}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 0.25rem;">
                        <span style="font-weight: bold; min-width: 1.5rem;">${ans.key.toUpperCase()}.</span>
                        <span>${escapeHtml(ans.value)}${icon}</span>
                    </div>
                    `;
                }).join('')}
            ${isCorrect ? `
                <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm font-semibold">
                    ✅ You answered correctly!
                </div>
            ` : `
                <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm font-semibold">
                    ❌ Incorrect. The correct answer was <strong>${correctAnswer.toUpperCase()}</strong>.
                </div>
            `}
        `;
    } else {
        // RENDER INTERACTIVE VIEW: Radio buttons
        optionsHtml = `
            <div class="quiz-options">
                ${answers.map(ans => `
                    <label class="quiz-option" style="cursor: pointer;">
                        <input type="radio" name="quiz-answer" value="${ans.key}" style="margin-right: 0.5rem;">
                        <span class="option-text">${escapeHtml(ans.value)}</span>
                    </label>
                `).join('')}
            </div>
            <button class="submit-quiz-btn" onclick="submitQuiz(this)">Submit Answer</button>
        `;
    }

    return `
        <div class="quiz-section" data-correct="${correctAnswer}" data-id="${currentDEI.id}" style="${isCompleted ? 'opacity: 0.9;' : ''}">
            <h4 class="quiz-question">${question}</h4>
            ${optionsHtml}
            ${!isCompleted ? `<div id="quiz-feedback-${currentDEI.id}" class="mt-2"></div>` : ''}
        </div>
    `;
}

function renderEmptyState(container) {
    const deiContent = document.getElementById('daily-energy-insight-content')
    deiContent.innerHTML = `
        <div class="empty-state">
            <p>No daily energy insight available today</p>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return dateStr;
    }
}

// Expose submitQuiz globally for the quiz button
window.submitQuiz = async function(btn) {
    const currentDEIProgress = getCorrectDeiProgress()
    const quizSection = btn.closest('.quiz-section');
    const selected = document.querySelector('input[name="quiz-answer"]:checked');
    
    if (!selected) {
        alert("Please select an answer");
        return;
    }

    // Disable button
    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {
        if (!supabaseClientGlob) {
            throw new Error("Client not initialized");
        }

        const { error } = await supabaseClientGlob
            .from('DEI progress')
            .update({ 
                given_answer: selected.value
            })
            .eq('id', currentDEIProgress.id)

        if (error) throw error;

        let completedBool
        do {
            await new Promise(r => setTimeout(r, 500));
            const {data: completed, getCompletedErr} = await supabaseClientGlob
                .from("DEI progress")
                .select("completed")
                .eq('id', currentDEIProgress.id)

            if (getCompletedErr) throw getCompletedErr

            completedBool = completed[0].completed

        } while (!completedBool)

        fetchAndRenderDetailedDEI(supabaseClientGlob);
        
    } catch (err) {
        console.error("Error submitting quiz:", err);
        btn.disabled = false;
        btn.textContent = "Submit Answer";
    }
};

export function closeInsightDetailView() {
    const detailView = document.getElementById('insight-detail-view');
    if (detailView) {
        detailView.classList.remove('active');
    }
}