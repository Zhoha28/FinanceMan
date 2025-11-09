// Main app state
const state = {
    currentMonth: '2025-11',
    theme: localStorage.getItem('theme') || 'dark',
    transactions: [],
    categories: [],
    accounts: [],
    budgets: {},
    meta: {},
    goals: JSON.parse(localStorage.getItem('financeGoals') || '{}'),
    notificationsEnabled: localStorage.getItem('notificationsEnabled') === 'true',
    upcomingBills: JSON.parse(localStorage.getItem('upcomingBills') || '[]')
};

const aiState = {
    summaries: {},
    askHistory: [],
    summaryLoading: {},
    summaryErrors: {}
};

const chartPalette = ['#6366F1', '#F97316', '#10B981', '#F472B6', '#FBBF24', '#22D3EE', '#94A3B8'];

// Store chart instances
const chartInstances = {
    trends: null,
    category: null
};

let insightsSidebarOpen = false;

async function ensureApiSuccess(response) {
    if (response.ok) return;
    let message = 'API Error';
    try {
        const data = await response.json();
        message = data.error || data.message || message;
    } catch (err) {
        // Ignore JSON parsing errors for empty bodies
    }
    throw new Error(message);
}

// API functions
const api = {
    async get(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        await ensureApiSuccess(response);
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        await ensureApiSuccess(response);
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        await ensureApiSuccess(response);
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'DELETE'
        });
        await ensureApiSuccess(response);
        return true;
    }
};

// Theme management
function initTheme() {
    if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    updateThemeIcons();
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    document.documentElement.classList.toggle('dark');
    updateThemeIcons();
}

function updateThemeIcons() {
    const sunIcon = document.querySelector('.sun');
    const moonIcon = document.querySelector('.moon');
    if (state.theme === 'dark') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

// Date and formatting utilities
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function formatMoney(amount) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function formatMonthYear(yearMonth) {
    const date = new Date(`${yearMonth}-01`);
    // Force UTC to avoid timezone issues
    date.setUTCHours(12);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC'
    });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-CA', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(99, 102, 241, ${alpha})`;
    let sanitized = hex.replace('#', '');
    if (sanitized.length === 3) {
        sanitized = sanitized.split('').map(c => c + c).join('');
    }
    const bigint = parseInt(sanitized, 16);
    if (Number.isNaN(bigint)) {
        return `rgba(99, 102, 241, ${alpha})`;
    }
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


// Navigation and routing
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const navLinksContainer = document.querySelector('.nav-links');
    const mobileToggle = document.querySelector('.mobile-nav-toggle');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            navigateToPage(page);
            if (window.innerWidth < 768 && navLinksContainer && mobileToggle) {
                navLinksContainer.classList.remove('open');
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    if (mobileToggle && navLinksContainer) {
        mobileToggle.addEventListener('click', () => {
            const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
            mobileToggle.setAttribute('aria-expanded', (!expanded).toString());
            navLinksContainer.classList.toggle('open', !expanded);
        });

        document.addEventListener('click', (event) => {
            if (!navLinksContainer.contains(event.target) && !mobileToggle.contains(event.target)) {
                navLinksContainer.classList.remove('open');
                mobileToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    window.addEventListener('resize', () => {
        if (navLinksContainer && mobileToggle && window.innerWidth >= 768) {
            navLinksContainer.classList.remove('open');
            mobileToggle.setAttribute('aria-expanded', 'false');
        }
        const activeLink = document.querySelector('.nav-link.active');
        moveNavPill(activeLink);
    });

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
            showPage(e.state.page);
        }
    });

    // Set initial page from URL hash or default to dashboard
    const initialPage = window.location.hash.slice(1) || 'dashboard';
    navigateToPage(initialPage, true);
}

function navigateToPage(pageId, replace = false) {
    // Update URL
    const method = replace ? 'replaceState' : 'pushState';
    window[`history`][method]({ page: pageId }, '', `#${pageId}`);
    
    // Show the page
    showPage(pageId);
}

function showPage(pageId) {
    // console.log('Showing page:', pageId); // Debug log
    
    // Hide all pages and deactivate nav links
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
        // console.log('Hiding page:', page.id); // Debug log
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        // console.log('Deactivating link:', link.dataset.page); // Debug log
    });
    
    // Show selected page and activate nav link
    const selectedPage = document.getElementById(pageId);
    const selectedLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    
    // console.log('Selected page:', selectedPage); // Debug log
    // console.log('Selected link:', selectedLink); // Debug log
    
    if (selectedPage && selectedLink) {
        selectedPage.classList.add('active');
        selectedPage.style.display = 'block';
        selectedLink.classList.add('active');
        moveNavPill(selectedLink);
        
        // Trigger page-specific updates
        updatePageContent(pageId);
        
        // console.log('Page activated:', pageId); // Debug log
    } else {
        console.error('Page or nav link not found:', pageId); // Debug log
        // console.log('Available pages:', Array.from(document.querySelectorAll('.page')).map(p => p.id)); // Debug log
        // console.log('Available nav links:', Array.from(document.querySelectorAll('.nav-link')).map(l => l.dataset.page)); // Debug log
    }
}

function moveNavPill(activeLink) {
    const pill = document.querySelector('[data-pill] span');
    if (!pill) return;

    if (window.innerWidth < 768 || !activeLink) {
        pill.style.opacity = 0;
        return;
    }

    const linkRect = activeLink.getBoundingClientRect();
    const navRect = activeLink.parentElement.getBoundingClientRect();
    const left = linkRect.left - navRect.left;

    pill.style.opacity = 1;
    pill.style.width = `${linkRect.width + 16}px`;
    pill.style.transform = `translate(${left - 8}px, -50%)`;
}

function initInsightsSidebar() {
    const sidebar = document.getElementById('insightsSidebar');
    const toggleButton = document.getElementById('insightsToggle');
    if (!sidebar || !toggleButton) return;

    const overlay = document.getElementById('insightsOverlay');
    const closeButton = document.getElementById('insightsClose');
    const quickLaunchButton = document.getElementById('insightsQuickLaunch');

    const setSidebarState = (isOpen) => {
        insightsSidebarOpen = isOpen;
        sidebar.classList.toggle('open', isOpen);
        sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    };

    toggleButton.addEventListener('click', () => {
        setSidebarState(!insightsSidebarOpen);
    });

    overlay?.addEventListener('click', () => setSidebarState(false));
    closeButton?.addEventListener('click', () => setSidebarState(false));
    quickLaunchButton?.addEventListener('click', () => setSidebarState(true));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && insightsSidebarOpen) {
            setSidebarState(false);
        }
    });

    setSidebarState(false);
}

// Page-specific content updates
function updatePageContent(pageId) {
    switch (pageId) {
        case 'dashboard':
            loadMonthData();
            break;
        case 'budgets':
            updateBudgets();
            break;
        case 'accounts':
            updateAccounts();
            break;
        case 'archive':
            loadArchiveData();
            break;
        case 'settings':
            updateSettings();
            break;
    }
}

// Month navigation
function initMonthNavigation() {
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    updateMonthDisplay();
}

function initDashboardShortcuts() {
    document.getElementById('dashboardLogTransaction')?.addEventListener('click', () => {
        document.getElementById('transactionForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.querySelector('.quick-add-btn')?.addEventListener('click', () => {
        document.getElementById('transactionForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('transactionDate')?.focus();
    });

    document.addEventListener('keydown', (event) => {
        if (event.shiftKey && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            document.getElementById('transactionForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('transactionDate')?.focus();
        }
    });
}

function initReminderSettings() {
    const statusEl = document.getElementById('notificationStatus');
    if (statusEl) {
        statusEl.textContent = state.notificationsEnabled
            ? 'Notifications enabled'
            : 'Notifications are off';
    }

    const enableBtn = document.getElementById('enableNotifications');
    if (enableBtn && !enableBtn.dataset.bound) {
        enableBtn.dataset.bound = 'true';
        enableBtn.addEventListener('click', async () => {
            if (!('Notification' in window)) {
                alert('Notifications are not supported in this browser.');
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                state.notificationsEnabled = true;
                localStorage.setItem('notificationsEnabled', 'true');
                if (statusEl) statusEl.textContent = 'Notifications enabled';
                maybeNotifyDailyStreak(true);
                checkUpcomingBills(true);
            } else {
                alert('Notifications permission denied.');
            }
        });
    }

    const billForm = document.getElementById('upcomingBillForm');
    if (billForm && !billForm.dataset.bound) {
        billForm.dataset.bound = 'true';
        billForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('billName').value.trim();
            const amount = Number(document.getElementById('billAmount').value);
            const dueDate = document.getElementById('billDueDate').value;
            if (!name || Number.isNaN(amount) || !dueDate) return;
            const bill = {
                id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
                name,
                amount,
                dueDate
            };
            state.upcomingBills.push(bill);
            localStorage.setItem('upcomingBills', JSON.stringify(state.upcomingBills));
            billForm.reset();
            renderUpcomingBills();
        });
    }

    renderUpcomingBills();
}

function renderUpcomingBills() {
    const list = document.getElementById('upcomingBillsList');
    if (!list) return;
    if (!state.upcomingBills.length) {
        list.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No upcoming bills yet.</p>';
        return;
    }
    list.innerHTML = state.upcomingBills.map(bill => `
        <div class="bill-card">
            <div>
                <p class="font-medium">${bill.name}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    Due ${formatDate(bill.dueDate)} · ${formatMoney(bill.amount)}
                </p>
            </div>
            <button onclick="removeBill('${bill.id}')">Remove</button>
        </div>
    `).join('');
}

function removeBill(id) {
    state.upcomingBills = state.upcomingBills.filter(bill => bill.id !== id);
    localStorage.setItem('upcomingBills', JSON.stringify(state.upcomingBills));
    renderUpcomingBills();
}

function changeMonth(delta) {
    const date = new Date(`${state.currentMonth}-01`);
    date.setMonth(date.getMonth() + delta);
    state.currentMonth = date.toISOString().slice(0, 7);
    updateMonthDisplay();
    loadMonthData();
}

function updateMonthDisplay() {
    const formatted = formatMonthYear(state.currentMonth);
    document.getElementById('currentMonth').textContent = formatted;
    const heroMonthValue = document.getElementById('heroMonthValue');
    if (heroMonthValue) heroMonthValue.textContent = formatted;

    const heroMonthLabel = document.getElementById('heroMonthLabel');
    if (heroMonthLabel) heroMonthLabel.textContent = formatted;

    updateAIContextForMonth();
}

function updateAIContextForMonth() {
    const label = formatMonthYear(state.currentMonth);
    const askMonth = document.getElementById('askAIMonthLabel');
    if (askMonth) askMonth.textContent = label;
    renderAICoachPanel();
    renderAskAIHistory();
}

// Data loading
async function loadMonthData() {
    try {
        state.transactions = await api.get(`/entries?month=${state.currentMonth}`);
        state.categories = await api.get('/categories');
        state.accounts = await api.get('/accounts');
        state.budgets = await api.get(`/budgets/${state.currentMonth}`);
        state.meta = await api.get(`/meta/${state.currentMonth}`);
        
        // Update all sections
        updateDashboard();
        updateTransactionsTable();
        updateBudgets();
        updateAccounts();
        updateCategories();
        updateCharts();
        updateInsights();
        
        // If we're on the archive page, load archive data
        if (document.querySelector('.nav-link[data-page="archive"].active')) {
            await loadArchiveData();
        }
        
        // If we're on the settings page, update settings
        if (document.querySelector('.nav-link[data-page="settings"].active')) {
            updateSettings();
        }

        renderAICoachPanel();
        renderAskAIHistory();
    } catch (err) {
        console.error('Failed to load data:', err);
    }

    ensureAISummaryForMonth(state.currentMonth);
}

function renderAICoachPanel() {
    const content = document.getElementById('aiCoachContent');
    const status = document.getElementById('aiCoachStatus');
    const timestamp = document.getElementById('aiCoachTimestamp');
    const monthLabel = document.getElementById('aiCoachMonthLabel');
    const refreshBtn = document.getElementById('refreshAICoachBtn');
    if (!content || !status || !timestamp || !monthLabel) return;

    monthLabel.textContent = formatMonthYear(state.currentMonth);

    const summary = aiState.summaries[state.currentMonth];
    const isLoading = aiState.summaryLoading[state.currentMonth];
    const error = aiState.summaryErrors[state.currentMonth];

    if (refreshBtn) {
        refreshBtn.disabled = Boolean(isLoading);
        refreshBtn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        refreshBtn.classList.toggle('opacity-60', Boolean(isLoading));
        refreshBtn.classList.toggle('cursor-not-allowed', Boolean(isLoading));
    }

    const showStatus = (message, { isError = false } = {}) => {
        status.textContent = message || '';
        status.classList.toggle('hidden', !message);
        status.classList.toggle('text-red-500', Boolean(message && isError));
        status.classList.toggle('text-gray-500', Boolean(message && !isError));
    };

    if (isLoading) {
        showStatus('Gemini is reviewing this month…');
        content.textContent = 'Crunching the latest budgets, cash flow, and categories.';
        timestamp.textContent = '';
        return;
    }

    if (error) {
        showStatus(error, { isError: true });
        content.textContent = 'No summary available yet.';
        timestamp.textContent = '';
        return;
    }

    showStatus('');

    if (summary?.text) {
        content.textContent = summary.text;
        const formatted = formatDateTime(summary.generatedAt);
        timestamp.textContent = formatted ? `Refreshed ${formatted}` : 'Generated this session.';
    } else {
        content.textContent = 'No summary yet. Gemini will auto-generate it shortly.';
        timestamp.textContent = '';
    }
}

async function ensureAISummaryForMonth(month, { force = false } = {}) {
    if (!month) return;
    if (!force && (aiState.summaryLoading[month] || aiState.summaries[month]?.text)) {
        renderAICoachPanel();
        return;
    }

    aiState.summaryErrors[month] = null;
    aiState.summaryLoading[month] = true;
    renderAICoachPanel();

    try {
        const result = await api.post('/ai/summary', { month });
        aiState.summaries[month] = {
            text: result.summary,
            generatedAt: result.generatedAt
        };
    } catch (err) {
        console.error('AI summary failed:', err);
        aiState.summaryErrors[month] = err.message || 'AI is unavailable right now.';
    } finally {
        aiState.summaryLoading[month] = false;
        renderAICoachPanel();
    }
}

function renderAskAIHistory() {
    const container = document.getElementById('askAIResponses');
    if (!container) return;
    container.innerHTML = '';

    const entries = aiState.askHistory.filter(item => item.month === state.currentMonth);
    if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'text-sm text-gray-500 dark:text-gray-400';
        empty.textContent = 'No questions yet. Ask Gemini something about this month.';
        container.appendChild(empty);
        return;
    }

    entries.slice(-4).reverse().forEach(entry => {
        const wrapper = document.createElement('div');
        wrapper.className = 'p-4 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700';

        const questionEl = document.createElement('p');
        questionEl.className = 'text-sm font-semibold text-gray-900 dark:text-gray-100';
        questionEl.textContent = `You asked: ${entry.question}`;

        const answerEl = document.createElement('p');
        answerEl.className = 'text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap';
        answerEl.textContent = entry.answer || 'No response.';

        const metaEl = document.createElement('p');
        metaEl.className = 'text-xs text-gray-500 dark:text-gray-400 mt-3';
        const formatted = formatDateTime(entry.generatedAt);
        metaEl.textContent = formatted ? `Answered ${formatted}` : '';

        wrapper.appendChild(questionEl);
        wrapper.appendChild(answerEl);
        wrapper.appendChild(metaEl);
        container.appendChild(wrapper);
    });
}

function setAskAIStatus(message, { isError = false } = {}) {
    const statusEl = document.getElementById('askAIStatus');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('hidden', !message);
    statusEl.classList.toggle('text-red-500', Boolean(message && isError));
    statusEl.classList.toggle('text-gray-500', Boolean(message && !isError));
}

function setAskAILoading(isLoading) {
    const button = document.getElementById('askAIButton');
    if (!button) return;
    if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = button.textContent;
    }
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Thinking…' : button.dataset.originalLabel;
}

async function handleAskAI(event) {
    if (event) event.preventDefault();
    const input = document.getElementById('askAIInput');
    if (!input) return;
    const question = input.value.trim();
    if (!question) {
        setAskAIStatus('Ask a question to get started.', { isError: true });
        return;
    }

    setAskAILoading(true);
    setAskAIStatus('Thinking…');
    try {
        const result = await api.post('/ai/ask', {
            month: state.currentMonth,
            question
        });
        aiState.askHistory.push({
            month: state.currentMonth,
            question,
            answer: result.answer,
            generatedAt: result.generatedAt
        });
        if (aiState.askHistory.length > 12) {
            aiState.askHistory = aiState.askHistory.slice(-12);
        }
        input.value = '';
        renderAskAIHistory();
        setAskAIStatus('Answered by Gemini.');
    } catch (err) {
        console.error('Ask AI failed:', err);
        setAskAIStatus(err.message || 'AI is unavailable right now.', { isError: true });
    } finally {
        setAskAILoading(false);
    }
}

function setSuggestCategoryStatus(message, isError = false) {
    const statusEl = document.getElementById('suggestCategoryStatus');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('hidden', !message);
    statusEl.classList.toggle('text-red-500', Boolean(message && isError));
    statusEl.classList.toggle('text-gray-500', Boolean(message && !isError));
}

async function handleSuggestCategory() {
    const notesEl = document.getElementById('transactionNotes');
    const categorySelect = document.getElementById('transactionCategory');
    const button = document.getElementById('suggestCategoryBtn');
    if (!notesEl || !categorySelect) return;
    const note = notesEl.value.trim();
    if (!note) {
        setSuggestCategoryStatus('Add a description first, then tap suggest.', true);
        return;
    }

    setSuggestCategoryStatus('Looking for a match…');
    if (button) button.disabled = true;
    try {
        const result = await api.post('/ai/suggest-category', {
            note,
            categories: state.categories.map(cat => ({ id: cat.id, name: cat.name }))
        });
        if (result.categoryId) {
            categorySelect.value = result.categoryId;
            setSuggestCategoryStatus(`Suggested: ${getCategoryName(result.categoryId)}`);
        } else {
            setSuggestCategoryStatus('No matching category found. Pick manually.', true);
        }
    } catch (err) {
        console.error('Suggest category failed:', err);
        setSuggestCategoryStatus(err.message || 'AI is unavailable right now.', true);
    } finally {
        if (button) button.disabled = false;
    }
}

// Dashboard updates
function updateDashboard() {
    // Update summary cards
    updateSummaryCards();
    
    updateWeeklyPeek();
    updateDailyStreak();
    updateGoals();
    updatePredictions();
    maybeNotifyDailyStreak();
    checkUpcomingBills();

    // Update category select in transaction form
    const categorySelect = document.getElementById('transactionCategory');
    categorySelect.innerHTML = state.categories.map(cat => 
        `<option value="${cat.id}" style="color: ${cat.color}">${cat.name}</option>`
    ).join('');
}

function getCategoryName(categoryId) {
    const category = state.categories.find(cat => cat.id === categoryId);
    return category?.name || 'Unknown';
}

function updateWeeklyPeek() {
    const spendEl = document.getElementById('weeklySpend');
    const saveEl = document.getElementById('weeklySave');
    const investEl = document.getElementById('weeklyInvest');
    if (!spendEl || !saveEl || !investEl) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);

    const weeklyTotals = state.transactions.reduce((acc, tx) => {
        const txDate = new Date(tx.date);
        if (txDate >= cutoff && txDate <= now) {
            if (tx.type === 'spend') acc.spending += Number(tx.amount);
            if (tx.type === 'save') acc.savings += Number(tx.amount);
            if (tx.type === 'invest') acc.investments += Number(tx.amount);
        }
        return acc;
    }, { spending: 0, savings: 0, investments: 0 });

    spendEl.textContent = formatMoney(weeklyTotals.spending);
    saveEl.textContent = formatMoney(weeklyTotals.savings);
    investEl.textContent = formatMoney(weeklyTotals.investments);
}

function updateDailyStreak() {
    const streakEl = document.getElementById('dailyStreak');
    if (!streakEl) return;

    if (!state.transactions.length) {
        streakEl.textContent = 'Start logging today!';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueDays = new Set(
        state.transactions.map(t => {
            const d = new Date(t.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })
    );

    let streak = 0;
    const cursor = new Date(today);
    while (uniqueDays.has(cursor.getTime())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    streakEl.textContent = streak > 0 ? `🔥 ${streak}-day streak` : 'Start logging today!';
}

function triggerConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    const colors = ['#f87171', '#34d399', '#60a5fa', '#fbbf24', '#c084fc'];
    const confettiCount = 20;

    for (let i = 0; i < confettiCount; i++) {
        const confetto = document.createElement('span');
        confetto.className = 'confetto';
        confetto.style.left = `${Math.random() * 100}%`;
        confetto.style.background = colors[i % colors.length];
        confetto.style.animationDelay = `${Math.random() * 0.2}s`;
        container.appendChild(confetto);
        setTimeout(() => confetto.remove(), 1400);
    }
}

function calcCompound(monthlyContribution, years, annualRate = 0.05) {
    if (!monthlyContribution) return 0;
    const monthlyRate = annualRate / 12;
    const periods = years * 12;
    if (monthlyRate === 0) return monthlyContribution * periods;
    return monthlyContribution * ((Math.pow(1 + monthlyRate, periods) - 1) / monthlyRate);
}

function updatePredictions() {
    const savingsYearEl = document.getElementById('predictionSavingsYear');
    if (!savingsYearEl) return;

    const monthlySavings = state.transactions
        .filter(t => t.type === 'save')
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyInvest = state.transactions
        .filter(t => t.type === 'invest')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const savingsYear = monthlySavings * 12;
    const savingsFive = savingsYear * 5;
    const investYear = monthlyInvest * 12;
    const investFive = calcCompound(monthlyInvest, 5, 0.05);

    document.getElementById('predictionSavingsYear').textContent = formatMoney(savingsYear);
    document.getElementById('predictionSavingsFive').textContent = formatMoney(savingsFive);
    document.getElementById('predictionInvestYear').textContent = formatMoney(investYear);
    document.getElementById('predictionInvestFive').textContent = formatMoney(investFive);
}
function updateGoals() {
    const defaultGoals = {
        emergency: { target: 5000, current: 0 },
        vacation: { target: 2000, current: 0 },
        invest: { target: 3000, current: 0 }
    };

    const mergedGoals = {};
    Object.keys(defaultGoals).forEach(key => {
        mergedGoals[key] = { ...defaultGoals[key], ...(state.goals[key] || {}) };
    });
    state.goals = mergedGoals;

    const goalMap = [
        { key: 'emergency', label: 'goalEmergency' },
        { key: 'vacation', label: 'goalVacation' },
        { key: 'invest', label: 'goalInvest' }
    ];

    goalMap.forEach(({ key, label }) => {
        const goal = state.goals[key];
        const valueEl = document.getElementById(label);
        const progressEl = document.getElementById(`${label}Progress`);
        if (!goal || !valueEl || !progressEl) return;

        valueEl.textContent = `${formatMoney(goal.current)} / ${formatMoney(goal.target)}`;
        const fill = goal.target ? Math.min(goal.current / goal.target, 1) * 100 : 0;
        progressEl.style.width = `${fill}%`;
    });

    document.querySelectorAll('.goal-edit').forEach(btn => {
        btn.onclick = () => editGoal(btn.dataset.goal);
    });
}

function editGoal(goalKey) {
    const goal = state.goals[goalKey];
    if (!goal) return;

    showModal({
        title: 'Edit Goal',
        content: `
            <form id="editGoalForm">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Target Amount</label>
                        <input type="number" id="goalTarget" value="${goal.target}" min="0" step="100" class="form-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Current Saved</label>
                        <input type="number" id="goalCurrent" value="${goal.current}" min="0" step="50" class="form-input">
                    </div>
                </div>
            </form>
        `,
        onConfirm: () => {
            const target = Number(document.getElementById('goalTarget').value);
            const current = Number(document.getElementById('goalCurrent').value);
            if (Number.isNaN(target) || Number.isNaN(current)) return;
            state.goals[goalKey] = {
                target,
                current
            };
            localStorage.setItem('financeGoals', JSON.stringify(state.goals));
            updateGoals();
        }
    });
}

function maybeNotifyDailyStreak(force = false) {
    if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const hasTodayEntry = state.transactions.some(tx => tx.date === todayKey);
    if (hasTodayEntry && !force) return;
    if (!force && today.getHours() < 18) return;
    const last = localStorage.getItem('lastStreakNotification');
    if (!force && last === todayKey) return;
    new Notification('Keep your streak alive', {
        body: 'You have not logged a transaction today. Add one to keep the streak going!'
    });
    localStorage.setItem('lastStreakNotification', todayKey);
}

function checkUpcomingBills(force = false) {
    if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (!state.upcomingBills.length) return;
    const today = new Date();
    state.upcomingBills.forEach(bill => {
        const dueDate = new Date(bill.dueDate);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays > 3) return;
        const key = `billNotify_${bill.id}_${bill.dueDate}`;
        if (!force && localStorage.getItem(key) === today.toDateString()) return;
        new Notification('Upcoming bill reminder', {
            body: `${bill.name} is due ${formatDate(bill.dueDate)} for ${formatMoney(bill.amount)}`
        });
        localStorage.setItem(key, today.toDateString());
    });
}

window.removeBill = removeBill;

// Budgets management
function updateBudgets() {
    const budgetsList = document.getElementById('budgetsList');
    if (!budgetsList) return;
    
    document.getElementById('budgetMonthDisplay').textContent = formatMonthYear(state.currentMonth);
    budgetsList.innerHTML = '';
    
    state.categories.forEach(category => {
        const budget = state.budgets[category.id] || 0;
        const spending = state.transactions
            .filter(t => t.type === 'spend' && t.category === category.id)
            .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const utilization = budget > 0 ? (spending / budget) * 100 : 0;
        let status = 'under';
        if (budget === 0 && spending > 0) {
            status = 'over';
        } else if (utilization >= 100) {
            status = 'over';
        } else if (utilization >= 80) {
            status = 'near';
        }
        const remaining = budget - spending;
        const statusLabel = status === 'over' ? 'Over budget' : status === 'near' ? 'Close to limit' : 'On track';
        const remainingText = remaining >= 0 ? `${formatMoney(remaining)} left` : `${formatMoney(Math.abs(remaining))} over`;
        const utilizationLabel = budget > 0 ? `${Math.min(utilization, 999).toFixed(0)}% used` : (spending > 0 ? 'No budget set' : 'No activity yet');
        const progressWidth = budget > 0 ? Math.min(utilization, 100) : (spending > 0 ? 100 : 0);
        
        const budgetCard = document.createElement('div');
        budgetCard.className = `budget-card ${status}`;
        budgetCard.innerHTML = `
            <div class="budget-card-header">
                <div class="category-chip">
                    <span class="chip-dot" style="background-color: ${category.color}"></span>
                    <span>${category.name}</span>
                </div>
                <span class="budget-status ${status}">${statusLabel}</span>
            </div>
            <div class="budget-amounts">
                <div class="budget-figure">
                    <span>Spent</span>
                    <strong>${formatMoney(spending)}</strong>
                </div>
                <div class="budget-figure">
                    <span>Budget</span>
                    <div class="budget-input-wrapper">
                        <input type="number"
                            value="${budget}"
                            min="0"
                            step="1"
                            class="form-input budget-input"
                            onchange="updateCategoryBudget('${category.id}', this.value)">
                    </div>
                </div>
            </div>
            <div class="budget-progress-track">
                <div class="budget-progress-fill ${status}" style="width: ${progressWidth}%"></div>
            </div>
            <div class="budget-meta">
                <span>${utilizationLabel}</span>
                <span>${remainingText}</span>
            </div>
        `;
        
        budgetsList.appendChild(budgetCard);
    });

    // Initialize copy last month's budget button
    document.getElementById('copyLastMonthBudget').onclick = async () => {
        try {
            const date = new Date(`${state.currentMonth}-01`);
            date.setMonth(date.getMonth() - 1);
            const lastMonth = date.toISOString().slice(0, 7);
            
            const lastMonthBudgets = await api.get(`/budgets/${lastMonth}`);
            if (lastMonthBudgets) {
                await api.post(`/budgets/${state.currentMonth}`, lastMonthBudgets);
                state.budgets = lastMonthBudgets;
                updateBudgets();
                updateCharts();
                updateInsights();
                alert('Successfully copied last month\'s budgets');
            }
        } catch (err) {
            console.error('Failed to copy last month\'s budgets:', err);
            alert('Failed to copy last month\'s budgets');
        }
    };
}

async function updateCategoryBudget(categoryId, amount) {
    const budgets = { ...state.budgets };
    budgets[categoryId] = Number(amount);
    
    try {
        await api.post(`/budgets/${state.currentMonth}`, budgets);
        state.budgets = budgets;
        updateBudgets();
        updateCharts();
        updateInsights();
    } catch (err) {
        console.error('Failed to update budget:', err);
        alert('Failed to update budget');
    }
}

function updateSummaryCards() {
    const totals = calculateTotals();
    
    const startBalanceEl = document.querySelector('[data-type="startBalance"]');
    const expectedIncomeEl = document.querySelector('[data-type="expectedIncome"]');
    const expectedExpenseEl = document.querySelector('[data-type="expectedExpense"]');
    
    // Calculate total starting balance from all accounts
    const totalStartBalance = state.accounts.reduce((total, account) => {
        const monthBalance = account.balances[state.currentMonth] || { start: 0, rate: 1 };
        // For INR→CAD accounts, apply the conversion rate
        const balance = account.currency === 'INR→CAD' 
            ? monthBalance.start * (monthBalance.rate || 1) 
            : monthBalance.start;
        return total + balance;
    }, 0);
    
    startBalanceEl.innerHTML = `
        <div class="metric-label">Starting Balance</div>
        <div class="metric-value">${formatMoney(totalStartBalance)}</div>
        <p class="metric-footnote">Across all accounts</p>
    `;
    
    expectedIncomeEl.innerHTML = `
        <div class="metric-header">
            <span class="metric-label">Expected Income</span>
            <button onclick="editFinancialExpectation('expectedIncome')" class="metric-edit">Edit</button>
        </div>
        <div class="metric-value">${formatMoney(state.meta.expectedIncome || 0)}</div>
        <p class="metric-footnote">Set your target coming into the month.</p>
    `;
    
    expectedExpenseEl.innerHTML = `
        <div class="metric-header">
            <span class="metric-label">Expected Expense</span>
            <button onclick="editFinancialExpectation('expectedExpense')" class="metric-edit">Edit</button>
        </div>
        <div class="metric-value">${formatMoney(state.meta.expectedExpense || 0)}</div>
        <p class="metric-footnote">Your planned monthly outflow.</p>
    `;
    
    const netChange = totals.savings + totals.investments - totals.spending;
    document.getElementById('netChange').innerHTML = `
        <div class="metric-label">Net Change</div>
        <div class="metric-value ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}">
            ${formatMoney(netChange)}
        </div>
        <p class="metric-footnote">Savings + investments − spending.</p>
    `;

    document.getElementById('snapshotSpending').textContent = formatMoney(totals.spending);
    document.getElementById('snapshotSavings').textContent = formatMoney(totals.savings);
    document.getElementById('snapshotInvestments').textContent = formatMoney(totals.investments);

    const heroNetChange = document.getElementById('heroNetChange');
    if (heroNetChange) {
        heroNetChange.textContent = formatMoney(netChange);
    }
}

async function editFinancialExpectation(type) {
    const labels = {
        expectedIncome: 'Expected Income',
        expectedExpense: 'Expected Expense'
    };
    
    if (type === 'startBalance') {
        console.warn('Starting balance cannot be edited manually');
        return;
    }
    
    const currentValue = state.meta[type] || 0;
    
    showModal({
        title: `Edit ${labels[type]}`,
        content: `
            <form id="editFinancialExpectationForm">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">${labels[type]}</label>
                        <input type="number" 
                            id="editExpectationValue" 
                            value="${currentValue}"
                            min="0" 
                            step="0.01" 
                            class="form-input">
                    </div>
                </div>
            </form>
        `,
        onConfirm: async () => {
            const value = Number(document.getElementById('editExpectationValue').value);
            const updates = { ...state.meta, [type]: value };
            
            try {
                await api.post(`/meta/${state.currentMonth}`, updates);
                state.meta = updates;
                updateSummaryCards();
                updateInsights();
            } catch (err) {
                console.error('Failed to update financial expectation:', err);
                alert('Failed to update financial expectation');
            }
        }
    });
}

function calculateTotals() {
    return state.transactions.reduce((acc, t) => {
        const amount = Number(t.amount);
        if (t.type === 'spend') acc.spending += amount;
        else if (t.type === 'save') acc.savings += amount;
        else if (t.type === 'invest') acc.investments += amount;
        return acc;
    }, { spending: 0, savings: 0, investments: 0 });
}

function initAISections() {
    const refreshBtn = document.getElementById('refreshAICoachBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            ensureAISummaryForMonth(state.currentMonth, { force: true });
        });
    }

    const askForm = document.getElementById('askAIForm');
    if (askForm) {
        askForm.addEventListener('submit', handleAskAI);
    }

    const suggestBtn = document.getElementById('suggestCategoryBtn');
    if (suggestBtn) {
        suggestBtn.addEventListener('click', handleSuggestCategory);
    }

    renderAICoachPanel();
    renderAskAIHistory();
}

// Transaction management
function initTransactionForm() {
    document.getElementById('transactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const transaction = {
            date: document.getElementById('transactionDate').value,
            type: document.getElementById('transactionType').value,
            category: document.getElementById('transactionCategory').value,
            amount: Number(document.getElementById('transactionAmount').value),
            notes: document.getElementById('transactionNotes').value
        };
        
        try {
            await api.post('/entries', transaction);
            e.target.reset();
            await loadMonthData();
            triggerConfetti();
        } catch (err) {
            console.error('Failed to add transaction:', err);
        }
    });
}

function updateTransactionsTable() {
    const tbody = document.getElementById('transactionsTable');
    tbody.innerHTML = '';
    
    state.transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(t => {
            const category = state.categories.find(c => c.id === t.category);
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900 dark:text-gray-100">${formatDate(t.date)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full ${
                        t.type === 'spend' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        t.type === 'save' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }">
                        ${t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 rounded-full text-sm font-medium" 
                        style="background-color: ${category?.color}20; color: ${category?.color}">
                        ${category?.name || 'Unknown'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm ${
                        t.type === 'spend' ? 'text-red-600 dark:text-red-400' :
                        t.type === 'save' ? 'text-green-600 dark:text-green-400' :
                        'text-blue-600 dark:text-blue-400'
                    } font-medium">
                        ${formatMoney(t.amount)}
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-500 dark:text-gray-400">${t.notes || ''}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="flex justify-end space-x-2">
                        <button class="px-3 py-1 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors" 
                            onclick="editTransaction('${t.id}')">Edit</button>
                        <button class="px-3 py-1 text-sm rounded bg-red-500 hover:bg-red-600 text-white transition-colors" 
                            onclick="deleteTransaction('${t.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
}

async function editTransaction(id) {
    const transaction = state.transactions.find(t => t.id === id);
    if (!transaction) return;
    
    showModal({
        title: 'Edit Transaction',
        content: `
            <form id="editTransactionForm">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Date</label>
                        <input type="date" id="editDate" value="${transaction.date}" class="form-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Type</label>
                        <select id="editType" class="form-select">
                            <option value="spend" ${transaction.type === 'spend' ? 'selected' : ''}>Spending</option>
                            <option value="save" ${transaction.type === 'save' ? 'selected' : ''}>Saving</option>
                            <option value="invest" ${transaction.type === 'invest' ? 'selected' : ''}>Investment</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Category</label>
                        <select id="editCategory" class="form-select">
                            ${state.categories.map(cat => `
                                <option value="${cat.id}" ${cat.id === transaction.category ? 'selected' : ''} 
                                    style="color: ${cat.color}">
                                    ${cat.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Amount</label>
                        <input type="number" id="editAmount" value="${transaction.amount}" 
                            min="0" step="0.01" class="form-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Notes</label>
                        <textarea id="editNotes" class="form-textarea">${transaction.notes || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Actions</label>
                        <select id="editAction" class="form-select">
                            <option value="update" selected>Update transaction</option>
                            <option value="duplicate">Duplicate transaction</option>
                            <option value="convert">Convert type (spend/save/invest)</option>
                        </select>
                    </div>
                </div>
            </form>
        `,
        onConfirm: async () => {
            const updates = {
                date: document.getElementById('editDate').value,
                type: document.getElementById('editType').value,
                category: document.getElementById('editCategory').value,
                amount: Number(document.getElementById('editAmount').value),
                notes: document.getElementById('editNotes').value
            };
            
            const action = document.getElementById('editAction').value;
            
            try {
                if (action === 'duplicate') {
                    await api.post('/entries', updates);
                } else {
                    await api.put(`/entries/${id}`, updates);
                }
                await loadMonthData();
            } catch (err) {
                console.error('Failed to process transaction:', err);
            }
        }
    });
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
        await api.delete(`/entries/${id}`);
        await loadMonthData();
    } catch (err) {
        console.error('Failed to delete transaction:', err);
    }
}

// Charts
function updateCharts() {
    updateCategoryPieChart();
    updateMonthlyTrendsChart();
}

function updateCategoryPieChart() {
    const canvas = document.getElementById('categoryPieChart');
    const fallback = document.getElementById('categoryChartFallback');
    const spendingByCategory = {};
    
    // Destroy existing chart if it exists
    if (chartInstances.category) {
        chartInstances.category.destroy();
        chartInstances.category = null;
    }
    
    state.transactions
        .filter(t => t.type === 'spend')
        .forEach(t => {
            const category = state.categories.find(c => c.id === t.category);
            if (category) {
                spendingByCategory[category.name] = 
                    (spendingByCategory[category.name] || 0) + Number(t.amount);
            }
        });

    if (Object.keys(spendingByCategory).length === 0) {
        canvas.classList.add('hidden');
        fallback.classList.remove('hidden');
        return;
    }

    canvas.classList.remove('hidden');
    fallback.classList.add('hidden');
    
    // Add background container
    canvas.style.backgroundColor = state.theme === 'dark' ? '#1F2937' : '#FFFFFF';
    canvas.style.borderRadius = '0.5rem';
    canvas.style.padding = '1rem';
    
    const ctx = canvas.getContext('2d');
    
    const palette = chartPalette.map(color =>
        state.theme === 'dark' ? hexToRgba(color, 0.85) : color
    );

    chartInstances.category = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(spendingByCategory),
            datasets: [{
                data: Object.values(spendingByCategory),
                backgroundColor: Object.keys(spendingByCategory).map((_, idx) =>
                    palette[idx % palette.length]
                ),
                borderColor: state.theme === 'dark' ? 'rgba(15, 23, 42, 0.7)' : '#FFFFFF',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: state.theme === 'dark' ? '#fff' : '#000'
                    }
                }
            }
        }
    });
}

async function updateMonthlyTrendsChart() {
    const canvas = document.getElementById('monthlyTrendsChart');
    const fallback = document.getElementById('trendsChartFallback');
    const months = [];
    const spending = [];
    const saving = [];
    const investing = [];
    
    try {
        // Ensure any existing chart is properly destroyed
        if (chartInstances.trends) {
            chartInstances.trends.destroy();
            chartInstances.trends = null;
        }

        // Get all transactions for processing
        const allTransactions = await api.get('/entries');
        
        // Get last 6 months of data
        for (let i = 5; i >= 0; i--) {
            const date = new Date(`${state.currentMonth}-01`);
            date.setMonth(date.getMonth() - i);
            const monthId = date.toISOString().slice(0, 7);
            
            // Filter transactions for this month
            const monthTransactions = allTransactions.filter(t => t.date.startsWith(monthId));
            
            const totals = monthTransactions.reduce((acc, t) => {
                const amount = Number(t.amount);
                if (t.type === 'spend') acc.spending += amount;
                else if (t.type === 'save') acc.saving += amount;
                else if (t.type === 'invest') acc.investing += amount;
                return acc;
            }, { spending: 0, saving: 0, investing: 0 });
            
            months.push(formatMonthYear(monthId));
            spending.push(totals.spending);
            saving.push(totals.saving);
            investing.push(totals.investing);
        }

        // Check if we have any data to display
        const hasData = spending.some(v => v > 0) || saving.some(v => v > 0) || investing.some(v => v > 0);
        
        if (!hasData) {
            canvas.classList.add('hidden');
            fallback.classList.remove('hidden');
            return;
        }

        canvas.classList.remove('hidden');
        fallback.classList.add('hidden');
        
        // Add background container
        canvas.style.backgroundColor = state.theme === 'dark' ? '#1F2937' : '#FFFFFF';
        canvas.style.borderRadius = '0.5rem';
        canvas.style.padding = '1rem';
        
        // Create new chart
        chartInstances.trends = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Spending',
                        data: spending,
                        backgroundColor: state.theme === 'dark' ? 'rgba(248, 113, 113, 0.65)' : '#EF4444'
                    },
                    {
                        label: 'Saving',
                        data: saving,
                        backgroundColor: state.theme === 'dark' ? 'rgba(52, 211, 153, 0.7)' : '#10B981'
                    },
                    {
                        label: 'Investing',
                        data: investing,
                        backgroundColor: state.theme === 'dark' ? 'rgba(99, 102, 241, 0.7)' : '#6366F1'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            color: state.theme === 'dark' ? '#fff' : '#000'
                        }
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            color: state.theme === 'dark' ? '#fff' : '#000',
                            callback: value => formatMoney(value)
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: state.theme === 'dark' ? '#fff' : '#000'
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Failed to update trends chart:', err);
        canvas.classList.add('hidden');
        fallback.classList.remove('hidden');
    }
}

// Insight Center
function updateInsights() {
    const insights = [];
    const totals = calculateTotals();
    
    // Budget alerts
    Object.entries(state.budgets).forEach(([categoryId, budget]) => {
        const spending = state.transactions
            .filter(t => t.type === 'spend' && t.category === categoryId)
            .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const category = state.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const percentage = (spending / budget) * 100;
        if (percentage >= 100) {
            insights.push({
                type: 'danger',
                message: `Over budget in ${category.name} by ${formatMoney(spending - budget)}`
            });
        } else if (percentage >= 80) {
            insights.push({
                type: 'warning',
                message: `Near budget limit in ${category.name} (${percentage.toFixed(0)}%)`
            });
        }
    });
    
    // Income/Expense expectations
    if (state.meta.expectedIncome) {
        const actualIncome = totals.savings + totals.investments;
        const incomePercentage = (actualIncome / state.meta.expectedIncome) * 100;
        if (incomePercentage < 80) {
            insights.push({
                type: 'warning',
                message: `Income at ${incomePercentage.toFixed(0)}% of expected`
            });
        }
    }
    
    if (state.meta.expectedExpense) {
        const expensePercentage = (totals.spending / state.meta.expectedExpense) * 100;
        if (expensePercentage > 100) {
            insights.push({
                type: 'danger',
                message: `Expenses exceeded expectations by ${(expensePercentage - 100).toFixed(0)}%`
            });
        }
    }
    
    // Display insights
    const themes = {
        danger: { label: 'Critical', icon: '!', iconClass: 'danger' },
        warning: { label: 'Caution', icon: '⚠', iconClass: 'warning' },
        info: { label: 'Heads Up', icon: '•', iconClass: 'info' }
    };
    
    const monthLabel = formatMonthYear(state.currentMonth);
    const insightsContainer = document.getElementById('insightsList');
    if (insightsContainer) {
        insightsContainer.innerHTML = insights.length ? insights.map(insight => {
            const theme = themes[insight.type] || themes.info;
            return `
                <div class="insight-card ${insight.type}">
                    <div class="insight-icon ${theme.iconClass}">${theme.icon}</div>
                    <div class="insight-content">
                        <div class="insight-meta">
                            <span>${theme.label}</span>
                            <span>•</span>
                            <span>${monthLabel}</span>
                        </div>
                        <p class="insight-message">${insight.message}</p>
                    </div>
                </div>
            `;
        }).join('') : `
            <div class="insights-empty">All clear — no signals for ${monthLabel}.</div>
        `;
    }

    const monthDisplay = document.getElementById('insightsMonth');
    if (monthDisplay) {
        monthDisplay.textContent = monthLabel;
    }

    const totalDisplay = document.getElementById('insightsTotal');
    if (totalDisplay) {
        totalDisplay.textContent = insights.length;
    }

    const badge = document.getElementById('insightsBadge');
    const count = document.getElementById('insightsCount');
    if (badge && count) {
        if (insights.length) {
            badge.classList.remove('hidden');
            count.textContent = insights.length;
        } else {
            badge.classList.add('hidden');
            count.textContent = '0';
        }
    }

    const heroSignals = document.getElementById('heroSignals');
    if (heroSignals) {
        const label = insights.length === 1 ? 'insight' : 'insights';
        heroSignals.textContent = `${insights.length} ${label}`;
    }
}

// Modal handling
function showModal({ title, content, onConfirm }) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');
    
    const closeModal = () => {
        modal.classList.add('hidden');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    confirmBtn.onclick = async () => {
        await onConfirm();
        closeModal();
    };
    
    cancelBtn.onclick = closeModal;
    modal.classList.remove('hidden');
}

// CSV Import/Export
function initImportExport() {
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('csvFileInput').click();
    });
    
    document.getElementById('csvFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/import', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Import failed');
            
            const result = await response.json();
            alert(result.message);
            await loadMonthData();
        } catch (err) {
            console.error('Failed to import:', err);
            alert('Import failed');
        }
        
        e.target.value = '';
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        window.location.href = '/api/export';
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initInsightsSidebar();
    initMonthNavigation();
    initDashboardShortcuts();
    initTransactionForm();
    initAISections();
    initCategories();
    loadMonthData();
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Settings
    document.getElementById('darkModeToggle').checked = state.theme === 'dark';
    document.getElementById('darkModeToggle').addEventListener('change', (e) => {
            if (e.target.checked !== (state.theme === 'dark')) {
                toggleTheme();
            }
        });

    // Initialize import/export handlers
    initImportExport();
});

// Accounts management
function updateAccounts() {
    const accountsList = document.getElementById('accountsList');
    if (!accountsList) return;

    accountsList.innerHTML = '';
    
    if (!state.accounts.length) {
        accountsList.innerHTML = '<p class="empty-state">No accounts yet. Add your first account above.</p>';
    }
    
    state.accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        
        const monthBalance = account.balances[state.currentMonth] || { start: 0, end: 0, rate: 1 };
        const classificationLabel = account.classification 
            ? account.classification.charAt(0).toUpperCase() + account.classification.slice(1)
            : 'Account';
        const change = (Number(monthBalance.end) || 0) - (Number(monthBalance.start) || 0);
        const changeClass = change >= 0 ? 'positive' : 'negative';
        
        accountCard.innerHTML = `
            <div class="account-card-header">
                <div>
                    <p class="account-eyebrow">${classificationLabel} · ${account.currency}</p>
                    <h3 class="account-name">${account.name}</h3>
                    <div class="account-chips">
                        <span class="account-chip">${classificationLabel}</span>
                        <span class="account-chip subtle">${account.currency}</span>
                    </div>
                </div>
                <div class="account-actions">
                    <button class="account-action" onclick="editAccount('${account.id}')">Edit</button>
                    <button class="account-action danger" onclick="deleteAccount('${account.id}')">Delete</button>
                </div>
            </div>
            <div class="account-metrics">
                <div class="account-metric editable">
                    <span class="account-metric-label">Start Balance</span>
                    <div class="account-input">
                        <span class="account-input-prefix">$</span>
                        <input type="number" 
                            value="${monthBalance.start}"
                            step="0.01"
                            class="form-input text-right"
                            onchange="updateAccountBalance('${account.id}', 'start', this.value)">
                    </div>
                </div>
                <div class="account-metric editable">
                    <span class="account-metric-label">End Balance</span>
                    <div class="account-input">
                        <span class="account-input-prefix">$</span>
                        <input type="number"
                            value="${monthBalance.end}"
                            step="0.01"
                            class="form-input text-right"
                            onchange="updateAccountBalance('${account.id}', 'end', this.value)">
                    </div>
                </div>
                <div class="account-metric">
                    <span class="account-metric-label">Change</span>
                    <strong class="account-change ${changeClass}">${formatMoney(change)}</strong>
                </div>
            </div>
            ${account.currency === 'INR→CAD' ? `
                <div class="account-rate-card">
                    <span class="account-metric-label">INR→CAD Rate</span>
                    <div class="account-input">
                        <span class="account-input-prefix">₹1 =</span>
                        <input type="number"
                            value="${monthBalance.rate || 1}"
                            step="0.0001"
                            class="form-input text-right"
                            onchange="updateAccountBalance('${account.id}', 'rate', this.value)">
                        <span class="account-input-suffix">CAD</span>
                    </div>
                </div>
            ` : ''}
        `;
        
        accountsList.appendChild(accountCard);
    });

    const addAccountForm = document.getElementById('addAccountForm');
    if (addAccountForm && !addAccountForm.dataset.bound) {
        addAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const account = {
                name: document.getElementById('newAccountName').value,
                currency: document.getElementById('newAccountCurrency').value,
                classification: document.getElementById('newAccountClassification').value,
                balances: {}
            };
            
            try {
                await api.post('/accounts', account);
                await loadMonthData();
                e.target.reset();
            } catch (err) {
                console.error('Failed to add account:', err);
                alert('Failed to add account');
            }
        });
        addAccountForm.dataset.bound = 'true';
    }
}

async function editAccount(accountId) {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return;
    
    showModal({
        title: 'Edit Account',
        content: `
            <form id="editAccountForm">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Account Name</label>
                        <input type="text" id="editAccountName" value="${account.name}" class="form-input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Currency Type</label>
                        <select id="editAccountCurrency" class="form-select">
                            <option value="CAD" ${account.currency === 'CAD' ? 'selected' : ''}>CAD</option>
                            <option value="INR→CAD" ${account.currency === 'INR→CAD' ? 'selected' : ''}>INR→CAD</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Classification</label>
                        <select id="editAccountClassification" class="form-select">
                            <option value="cash" ${account.classification === 'cash' ? 'selected' : ''}>Cash</option>
                            <option value="savings" ${account.classification === 'savings' ? 'selected' : ''}>Savings</option>
                            <option value="investment" ${account.classification === 'investment' ? 'selected' : ''}>Investment</option>
                            <option value="other" ${account.classification === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
            </form>
        `,
        onConfirm: async () => {
            const updates = {
                name: document.getElementById('editAccountName').value,
                currency: document.getElementById('editAccountCurrency').value,
                classification: document.getElementById('editAccountClassification').value
            };
            
            try {
                await api.put(`/accounts/${accountId}`, updates);
                await loadMonthData();
            } catch (err) {
                console.error('Failed to update account:', err);
                alert('Failed to update account');
            }
        }
    });
}

async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) return;
    
    try {
        await api.delete(`/accounts/${accountId}`);
        await loadMonthData();
    } catch (err) {
        console.error('Failed to delete account:', err);
        alert('Failed to delete account');
    }
}

async function updateAccountBalance(accountId, field, value) {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return;
    
    const balances = account.balances[state.currentMonth] || { start: 0, end: 0, rate: 1 };
    balances[field] = Number(value);
    
    try {
        await api.put(`/accounts/${accountId}`, {
            ...account,
            balances: {
                ...account.balances,
                [state.currentMonth]: balances
            }
        });
        await loadMonthData();
    } catch (err) {
        console.error('Failed to update balance:', err);
        alert('Failed to update balance');
    }
}

// Categories management
function initCategories() {
    document.getElementById('addCategoryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const category = {
            name: document.getElementById('newCategoryName').value,
            color: document.getElementById('newCategoryColor').value
        };
        
        try {
            await api.post('/categories', category);
            await loadMonthData();
            e.target.reset();
            document.getElementById('newCategoryColor').value = '#' + Math.floor(Math.random()*16777215).toString(16);
        } catch (err) {
            console.error('Failed to add category:', err);
            alert('Failed to add category');
        }
    });
}

function updateCategories() {
    const categoriesList = document.getElementById('categoriesList');
    if (!categoriesList) return;

    categoriesList.innerHTML = '';
    
    state.categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'section-card';
        categoryCard.innerHTML = `
            <div class="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center" 
                        style="background-color: ${category.color}20">
                        <span class="w-6 h-6 rounded-full" 
                            style="background-color: ${category.color}"></span>
                    </div>
                    <span class="text-lg font-medium dark:text-white">${category.name}</span>
                </div>
                <div class="flex items-center space-x-3">
                    <div class="relative group">
                        <input type="color"
                            value="${category.color}"
                            class="h-8 w-8 rounded cursor-pointer hover:scale-110 transition-transform"
                            onchange="updateCategoryColor('${category.id}', this.value)">
                        <span class="absolute -top-8 left-1/2 transform -translate-x-1/2 
                            bg-gray-800 text-white text-xs px-2 py-1 rounded 
                            opacity-0 group-hover:opacity-100 transition-opacity">
                            Change Color
                        </span>
                    </div>
                    <button class="px-3 py-1 text-sm rounded bg-red-500 hover:bg-red-600 text-white transition-colors" 
                        onclick="deleteCategory('${category.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        categoriesList.appendChild(categoryCard);
    });
}

async function updateCategoryColor(categoryId, color) {
    try {
        await api.put(`/categories/${categoryId}`, { color });
        await loadMonthData();
    } catch (err) {
        console.error('Failed to update category color:', err);
        alert('Failed to update category color');
    }
}

async function deleteCategory(categoryId) {
    // Check if category is used in any transactions
    const usedInTransactions = state.transactions.some(t => t.category === categoryId);
    
    if (usedInTransactions) {
        if (!confirm('This category is used in some transactions. Deleting it may affect your records. Continue?')) {
            return;
        }
    } else if (!confirm('Are you sure you want to delete this category?')) {
        return;
    }
    
    try {
        await api.delete(`/categories/${categoryId}`);
        await loadMonthData();
    } catch (err) {
        console.error('Failed to delete category:', err);
        alert('Failed to delete category');
    }
}

// Archive management
async function loadArchiveData() {
    const archiveList = document.getElementById('archiveList');
    if (!archiveList) return;

    archiveList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>';
    
    const allTransactions = await api.get('/entries');
    const months = [...new Set(allTransactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    
    if (!months.length) {
        archiveList.innerHTML = '<p class="empty-state">No archived months yet.</p>';
        return;
    }
    
    archiveList.innerHTML = '';
    
    for (const month of months) {
        const monthData = allTransactions.filter(t => t.date.startsWith(month));
        const totals = monthData.reduce((acc, t) => {
            const amount = Number(t.amount);
            if (t.type === 'spend') acc.spending += amount;
            else if (t.type === 'save') acc.savings += amount;
            else if (t.type === 'invest') acc.investments += amount;
            return acc;
        }, { spending: 0, savings: 0, investments: 0 });
        const monthLabel = formatMonthYear(month);

        const monthCard = document.createElement('div');
        monthCard.className = 'archive-card';
        monthCard.id = `archive-card-${month}`;
        monthCard.innerHTML = `
            <button type="button" class="archive-card-header" id="archive-header-${month}" aria-expanded="false" aria-controls="details-${month}" onclick="toggleArchiveMonth('${month}')">
                <div>
                    <p class="archive-eyebrow">Statement</p>
                    <h3 class="archive-title">${monthLabel}</h3>
                </div>
                <div class="archive-summary">
                    <div class="archive-summary-item">
                        <span>Spending</span>
                        <strong>${formatMoney(totals.spending)}</strong>
                    </div>
                    <div class="archive-summary-item">
                        <span>Savings</span>
                        <strong>${formatMoney(totals.savings)}</strong>
                    </div>
                    <div class="archive-summary-item">
                        <span>Investments</span>
                        <strong>${formatMoney(totals.investments)}</strong>
                    </div>
                </div>
                <svg id="arrow-${month}" class="archive-arrow" width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="archive-details hidden" id="details-${month}">
                <div class="archive-detail-grid">
                    <div>
                        <span>Entries</span>
                        <strong>${monthData.length}</strong>
                    </div>
                    <div>
                        <span>Net Flow</span>
                        <strong class="${(totals.savings + totals.investments - totals.spending) >= 0 ? 'text-green-500' : 'text-red-500'}">
                            ${formatMoney((totals.savings + totals.investments) - totals.spending)}
                        </strong>
                    </div>
                </div>
                <div class="archive-table-wrapper">
                    <table class="archive-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthData.map(t => {
                                const category = state.categories.find(c => c.id === t.category);
                                return `
                                    <tr>
                                        <td>${formatDate(t.date)}</td>
                                        <td>${t.type}</td>
                                        <td>
                                            <span class="category-badge" style="background-color: ${category?.color}">
                                                ${category?.name || 'Unknown'}
                                            </span>
                                        </td>
                                        <td>${formatMoney(t.amount)}</td>
                                        <td>${t.notes || ''}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        archiveList.appendChild(monthCard);
    }
}

function toggleArchiveMonth(month) {
    const details = document.getElementById(`details-${month}`);
    const arrow = document.getElementById(`arrow-${month}`);
    const card = document.getElementById(`archive-card-${month}`);
    const header = document.getElementById(`archive-header-${month}`);
    if (!details) return;
    
    details.classList.toggle('hidden');
    const isOpen = !details.classList.contains('hidden');
    if (arrow) arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
    if (card) card.classList.toggle('open', isOpen);
    if (header) header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// Settings management
function updateSettings() {
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    darkModeToggle.checked = state.theme === 'dark';
    
    // Export transactions
    document.getElementById('exportTransactionsBtn')?.addEventListener('click', () => {
        window.location.href = '/api/export';
    });
    
    // Import transactions
    document.getElementById('importTransactionsInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/import', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Import failed');
            
            const result = await response.json();
            alert(result.message);
            await loadMonthData();
        } catch (err) {
            console.error('Failed to import:', err);
            alert('Failed to import transactions');
        }
        
        e.target.value = '';
    });

    initReminderSettings();
}
