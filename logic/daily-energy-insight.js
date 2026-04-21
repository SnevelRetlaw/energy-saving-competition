export function initDailyEnergyInsight(supabaseClient) {
    console.log("Daily Energy Insight module initialized");
    
    if (supabaseClient) {
        fetchDailyEnergyInsight(supabaseClient);
    }
}

async function fetchDailyEnergyInsight(client) {
    const tile = document.querySelector('.dashboard-grid > .tile:first-child');
    
    if (!tile) {
        console.error("Daily Energy Insight tile not found");
        return;
    }
    
    try {
        // Fetch the current daily insight (not completed)
        const { data, error } = await client
            .from('Daily energy insight')
            .select('*');
        
        if (error) {
            console.error("Error fetching daily energy insight:", error);
            renderError(tile, error.message);
            return;
        }
        
        if (!data || data.length === 0) {
            renderEmptyState(tile);
            return;
        }
        
        const energyInsight = data[0];
        renderEnergyInsight(energyInsight, tile);
        
    } catch (err) {
        console.error("Unexpected error:", err);
        renderError(tile, "Failed to load energyInsight");
    }
}

function renderEnergyInsight(energyInsight, container) {
    // Remove placeholder content
    const placeholder = container.querySelector('.placeholder-content');
    if (placeholder) placeholder.remove();
    
    // Create energyInsight content
    const content = document.createElement('div');
    content.className = 'energy-insight-content';
    content.innerHTML = `
        <div class="energy-insight-header">
            <h3 class="energy-insight-title">${escapeHtml(energyInsight.title)}</h3>
            <span class="energy-insight-date">${formatDate(energyInsight.date)}</span>
        </div>
        <div class="energy-insight-info">
            <p class="energy-insight-description">${escapeHtml(energyInsight.information)}</p>
        </div>
        ${energyInsight.quiz ? renderQuiz(energyInsight.quiz) : ''}
        ${energyInsight.activity ? `<div class="activity-section"><strong>Activity:</strong> ${escapeHtml(energyInsight.activity)}</div>` : ''}
        <div class="energy-insight-score">
            <span class="score-label">Score:</span>
            <span class="score-value">${energyInsight.score}</span>
        </div>
    `;
    
    container.appendChild(content);
}

function renderQuiz(quiz) {
    const question = escapeHtml(quiz.question || '');
    const answers = [
        { key: 'a', value: quiz.answer_a },
        { key: 'b', value: quiz.answer_b },
        { key: 'c', value: quiz.answer_c },
        { key: 'd', value: quiz.answer_d }
    ];
    
    return `
        <div class="quiz-section" data-correct="${quiz.correct_answer}">
            <h4 class="quiz-question">${question}</h4>
            <div class="quiz-options">
                ${answers.map(ans => `
                    <label class="quiz-option">
                        <input type="radio" name="quiz-answer" value="${ans.key}">
                        <span class="option-text">${escapeHtml(ans.value)}</span>
                    </label>
                `).join('')}
            </div>
            <button class="submit-quiz-btn" onclick="submitQuiz(this)">Submit Answer</button>
        </div>
    `;
}

function renderEmptyState(container) {
    const placeholder = container.querySelector('.placeholder-content');
    if (placeholder) {
        placeholder.innerHTML = `
            <div>
                <svg class="w-12 h-12 mx-auto mb-2 placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <p>No daily energy-insight available today</p>
            </div>
        `;
    }
}

function renderError(container, message) {
    const placeholder = container.querySelector('.placeholder-content');
    if (placeholder) {
        placeholder.innerHTML = `
            <div class="error-state">
                <p>⚠️ Error loading energy-insight</p>
                <small>${escapeHtml(message)}</small>
            </div>
        `;
    }
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
    const quizSection = btn.closest('.quiz-section');
    const selected = document.querySelector('input[name="quiz-answer"]:checked');
    const correctAnswer = quizSection.dataset.correct;
    
    if (!selected) {
        alert("Please select an answer");
        return;
    }
    
    console.log("Quiz submitted:", selected.value, "Correct:", correctAnswer);
    alert(`You selected: ${selected.value}\nCorrect answer: ${correctAnswer}`);
    
    // TODO: Update completed status in Supabase
};