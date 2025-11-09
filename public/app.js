// Main app state
const state = {
    currentMonth: '2025-11',
    theme: localStorage.getItem('theme') || 'dark',
    transactions: [],
    categories: [],
    accounts: [],
    budgets: {},
    meta: {}
};

// Store chart instances
const chartInstances = {
    trends: null,
    category: null
};

// API functions
const api = {
    async get(endpoint) {
        const response = await fetch(`/api${endpoint}`);
        if (!response.ok) throw new Error('API Error');
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('API Error');
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('API Error');
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`/api${endpoint}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('API Error');
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

// Navigation and routing
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            navigateToPage(page);
        });
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
        
        // Trigger page-specific updates
        updatePageContent(pageId);
        
        // console.log('Page activated:', pageId); // Debug log
    } else {
        console.error('Page or nav link not found:', pageId); // Debug log
        // console.log('Available pages:', Array.from(document.querySelectorAll('.page')).map(p => p.id)); // Debug log
        // console.log('Available nav links:', Array.from(document.querySelectorAll('.nav-link')).map(l => l.dataset.page)); // Debug log
    }
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

function changeMonth(delta) {
    const date = new Date(`${state.currentMonth}-01`);
    date.setMonth(date.getMonth() + delta);
    state.currentMonth = date.toISOString().slice(0, 7);
    updateMonthDisplay();
    loadMonthData();
}

function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = formatMonthYear(state.currentMonth);
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
        updateSmartAlerts();
        
        // If we're on the archive page, load archive data
        if (document.querySelector('.nav-link[data-page="archive"].active')) {
            await loadArchiveData();
        }
        
        // If we're on the settings page, update settings
        if (document.querySelector('.nav-link[data-page="settings"].active')) {
            updateSettings();
        }
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

// Dashboard updates
function updateDashboard() {
    // Update summary cards
    updateSummaryCards();
    
    // Update category select in transaction form
    const categorySelect = document.getElementById('transactionCategory');
    categorySelect.innerHTML = state.categories.map(cat => 
        `<option value="${cat.id}" style="color: ${cat.color}">${cat.name}</option>`
    ).join('');
}

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
        
        const percentage = budget > 0 ? (spending / budget) * 100 : 0;
        const status = percentage >= 100 ? 'over' : percentage >= 80 ? 'near' : 'under';
        const remaining = budget - spending;
        
        const budgetItem = document.createElement('div');
        budgetItem.className = 'space-y-2';
        budgetItem.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <span class="w-4 h-4 rounded-full" style="background-color: ${category.color}"></span>
                    <span class="font-medium">${category.name}</span>
                </div>
                <input type="number" 
                    value="${budget}"
                    min="0" 
                    step="1"
                    class="form-input w-32"
                    onchange="updateCategoryBudget('${category.id}', this.value)">
            </div>
            <div class="budget-progress">
                <div class="budget-progress-bar ${status}"
                    style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>Spent: ${formatMoney(spending)}</span>
                <span>Budget: ${formatMoney(budget)}</span>
            </div>
        `;
        
        const budgetCard = document.createElement('div');
        budgetCard.className = 'section-card p-4';
        budgetCard.innerHTML = `
            <div class="flex flex-col space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center" 
                            style="background-color: ${category.color}20">
                            <span class="w-6 h-6 rounded-full" 
                                style="background-color: ${category.color}"></span>
                        </div>
                        <span class="text-lg font-medium dark:text-white">${category.name}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-500 dark:text-gray-400">Budget:</span>
                        <input type="number" 
                            value="${budget}"
                            min="0" 
                            step="1"
                            class="form-input w-32 text-right font-medium"
                            onchange="updateCategoryBudget('${category.id}', this.value)">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-6 mt-4">
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <span class="text-sm text-gray-500 dark:text-gray-400 block mb-1">Spent</span>
                        <span class="text-xl font-semibold dark:text-white">${formatMoney(spending)}</span>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <span class="text-sm text-gray-500 dark:text-gray-400 block mb-1">Remaining</span>
                        <span class="text-xl font-semibold ${remaining < 0 ? 'text-red-500' : 'text-green-500'}">
                            ${formatMoney(remaining)}
                        </span>
                    </div>
                </div>
                <div class="mt-4">
                    <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500 ${
                            status === 'over' ? 'bg-red-500' :
                            status === 'near' ? 'bg-yellow-500' :
                            'bg-green-500'
                        }" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <div class="text-sm font-medium ${
                            status === 'over' ? 'text-red-500' :
                            status === 'near' ? 'text-yellow-500' :
                            'text-green-500'
                        }">
                            ${budget > 0 ? `${percentage.toFixed(1)}% used` : 'No budget set'}
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            ${formatMoney(budget)} total
                        </div>
                    </div>
                </div>
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
                updateSmartAlerts();
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
        updateSmartAlerts();
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
        <div class="flex flex-col p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">Starting Balance</span>
            <span class="text-2xl font-semibold">${formatMoney(totalStartBalance)}</span>
        </div>
    `;
    
    expectedIncomeEl.innerHTML = `
        <div class="flex flex-col p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div class="flex justify-between items-start mb-1">
                <span class="text-sm text-gray-500 dark:text-gray-400">Expected Income</span>
                <button onclick="editFinancialExpectation('expectedIncome')" 
                    class="ml-2 px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white">
                    Edit
                </button>
            </div>
            <span class="text-2xl font-semibold">${formatMoney(state.meta.expectedIncome || 0)}</span>
        </div>
    `;
    
    expectedExpenseEl.innerHTML = `
        <div class="flex flex-col p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div class="flex justify-between items-start mb-1">
                <span class="text-sm text-gray-500 dark:text-gray-400">Expected Expense</span>
                <button onclick="editFinancialExpectation('expectedExpense')" 
                    class="ml-2 px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white">
                    Edit
                </button>
            </div>
            <span class="text-2xl font-semibold">${formatMoney(state.meta.expectedExpense || 0)}</span>
        </div>
    `;
    
    const netChange = totals.savings + totals.investments - totals.spending;
    document.getElementById('netChange').innerHTML = `
        <div class="flex flex-col p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">Net Change</span>
            <span class="text-2xl font-semibold ${netChange >= 0 ? 'text-green-500' : 'text-red-500'}">
                ${formatMoney(netChange)}
            </span>
        </div>
    `;
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
                updateSmartAlerts();
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
            
            try {
                await api.put(`/entries/${id}`, updates);
                await loadMonthData();
            } catch (err) {
                console.error('Failed to update transaction:', err);
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
    
    chartInstances.category = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(spendingByCategory),
            datasets: [{
                data: Object.values(spendingByCategory),
                backgroundColor: state.categories
                    .filter(c => Object.keys(spendingByCategory).includes(c.name))
                    .map(c => c.color)
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
                        backgroundColor: '#EF4444'
                    },
                    {
                        label: 'Saving',
                        data: saving,
                        backgroundColor: '#10B981'
                    },
                    {
                        label: 'Investing',
                        data: investing,
                        backgroundColor: '#6366F1'
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

// Smart Alerts
function updateSmartAlerts() {
    const alerts = [];
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
            alerts.push({
                type: 'danger',
                message: `Over budget in ${category.name} by ${formatMoney(spending - budget)}`
            });
        } else if (percentage >= 80) {
            alerts.push({
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
            alerts.push({
                type: 'warning',
                message: `Income at ${incomePercentage.toFixed(0)}% of expected`
            });
        }
    }
    
    if (state.meta.expectedExpense) {
        const expensePercentage = (totals.spending / state.meta.expectedExpense) * 100;
        if (expensePercentage > 100) {
            alerts.push({
                type: 'danger',
                message: `Expenses exceeded expectations by ${(expensePercentage - 100).toFixed(0)}%`
            });
        }
    }
    
    // Display alerts
    const alertsContainer = document.getElementById('smartAlerts');
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="alert-badge ${alert.type}">
            ${alert.message}
        </div>
    `).join('');
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
    initMonthNavigation();
    initTransactionForm();
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
    
    state.accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'section-card p-4';
        
        const monthBalance = account.balances[state.currentMonth] || { start: 0, end: 0, rate: 1 };
        
        accountCard.innerHTML = `
            <div class="flex flex-col p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-lg font-semibold dark:text-white mb-2">${account.name}</h3>
                        <div class="flex space-x-4">
                            <span class="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                ${account.classification.charAt(0).toUpperCase() + account.classification.slice(1)}
                            </span>
                            <span class="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                ${account.currency}
                            </span>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="px-3 py-1 text-sm rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors" 
                            onclick="editAccount('${account.id}')">Edit</button>
                        <button class="px-3 py-1 text-sm rounded bg-red-500 hover:bg-red-600 text-white transition-colors" 
                            onclick="deleteAccount('${account.id}')">Delete</button>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-6 mb-6">
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div class="flex flex-col">
                            <label class="text-sm text-gray-500 dark:text-gray-400 mb-2">Start Balance</label>
                            <div class="flex items-center">
                                <span class="text-gray-400 mr-2">$</span>
                                <input type="number" 
                                    value="${monthBalance.start}"
                                    step="0.01"
                                    class="form-input flex-1 text-right font-medium text-lg"
                                    onchange="updateAccountBalance('${account.id}', 'start', this.value)">
                            </div>
                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div class="flex flex-col">
                            <label class="text-sm text-gray-500 dark:text-gray-400 mb-2">End Balance</label>
                            <div class="flex items-center">
                                <span class="text-gray-400 mr-2">$</span>
                                <input type="number"
                                    value="${monthBalance.end}"
                                    step="0.01"
                                    class="form-input flex-1 text-right font-medium text-lg"
                                    onchange="updateAccountBalance('${account.id}', 'end', this.value)">
                            </div>
                        </div>
                    </div>
                </div>
                ${account.currency === 'INR→CAD' ? `
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div class="flex flex-col">
                            <label class="text-sm text-gray-500 dark:text-gray-400 mb-2">INR→CAD Rate</label>
                            <div class="flex items-center">
                                <span class="text-gray-400 mr-2">₹1 =</span>
                                <input type="number"
                                    value="${monthBalance.rate || 1}"
                                    step="0.0001"
                                    class="form-input flex-1 text-right font-medium"
                                    onchange="updateAccountBalance('${account.id}', 'rate', this.value)">
                                <span class="text-gray-400 ml-2">CAD</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        accountsList.appendChild(accountCard);
    });

    // Initialize add account form
    document.getElementById('addAccountForm')?.addEventListener('submit', async (e) => {
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

    archiveList.innerHTML = `
        <div class="grid gap-6 p-6">
            <h2 class="text-2xl font-semibold dark:text-white mb-4">Transaction History</h2>
            <div class="space-y-6" id="archiveMonths"></div>
        </div>
    `;
    
    const archiveMonths = document.getElementById('archiveMonths');
    
    // Get all months with transactions
    const allTransactions = await api.get('/entries');
    const months = [...new Set(allTransactions.map(t => t.date.slice(0, 7)))].sort().reverse();
    
    for (const month of months) {
        const monthData = allTransactions.filter(t => t.date.startsWith(month));
        const totals = monthData.reduce((acc, t) => {
            const amount = Number(t.amount);
            if (t.type === 'spend') acc.spending += amount;
            else if (t.type === 'save') acc.savings += amount;
            else if (t.type === 'invest') acc.investments += amount;
            return acc;
        }, { spending: 0, savings: 0, investments: 0 });

        const monthCard = document.createElement('div');
        monthCard.className = 'section-card';
        monthCard.innerHTML = `
            <div class="p-4 cursor-pointer" onclick="toggleArchiveMonth('${month}')">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium">${formatMonthYear(month)}</h3>
                    <svg class="w-5 h-5 transform transition-transform" id="arrow-${month}">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" fill="none" stroke-width="2"/>
                    </svg>
                </div>
            </div>
            <div class="hidden" id="details-${month}">
                <div class="px-4 pb-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <span class="text-sm text-gray-500 dark:text-gray-400">Total Spending:</span>
                            <div class="font-medium">${formatMoney(totals.spending)}</div>
                        </div>
                        <div>
                            <span class="text-sm text-gray-500 dark:text-gray-400">Total Savings:</span>
                            <div class="font-medium">${formatMoney(totals.savings)}</div>
                        </div>
                        <div>
                            <span class="text-sm text-gray-500 dark:text-gray-400">Total Investments:</span>
                            <div class="font-medium">${formatMoney(totals.investments)}</div>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead>
                                <tr class="text-left bg-gray-50 dark:bg-gray-700">
                                    <th class="px-4 py-2">Date</th>
                                    <th class="px-4 py-2">Type</th>
                                    <th class="px-4 py-2">Category</th>
                                    <th class="px-4 py-2">Amount</th>
                                    <th class="px-4 py-2">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthData.map(t => {
                                    const category = state.categories.find(c => c.id === t.category);
                                    return `
                                        <tr>
                                            <td class="px-4 py-2">${formatDate(t.date)}</td>
                                            <td class="px-4 py-2">${t.type}</td>
                                            <td class="px-4 py-2">
                                                <span class="category-badge" style="background-color: ${category?.color}">
                                                    ${category?.name || 'Unknown'}
                                                </span>
                                            </td>
                                            <td class="px-4 py-2">${formatMoney(t.amount)}</td>
                                            <td class="px-4 py-2">${t.notes || ''}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        archiveList.appendChild(monthCard);
    }
}

function toggleArchiveMonth(month) {
    const details = document.getElementById(`details-${month}`);
    const arrow = document.getElementById(`arrow-${month}`);
    
    details.classList.toggle('hidden');
    arrow.style.transform = details.classList.contains('hidden') ? '' : 'rotate(90deg)';
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
}