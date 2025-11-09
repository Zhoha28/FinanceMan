const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL;
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1';
const DEFAULT_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro',
    'gemini-1.0-pro-latest'
];

if (!GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY is not set. AI routes will return errors until it is configured.');
}

async function callGemini(prompt, { temperature = 0.4, maxOutputTokens = 1024 } = {}) {
    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key missing. Set GEMINI_API_KEY in your .env file.');
    }

    const modelsToTry = GEMINI_MODEL ? [GEMINI_MODEL] : DEFAULT_MODELS;
    let lastError;

    for (const modelName of modelsToTry) {
        try {
            console.log('[AI] Calling Gemini model:', modelName);
            return await invokeModel(modelName, prompt, { temperature, maxOutputTokens });
        } catch (err) {
            lastError = err;
            const message = err.response?.data?.error?.message || err.message || '';
            const isMissingModel = err.response?.status === 404 ||
                /not found.*models\//i.test(message) ||
                /Call ListModels/i.test(message);
            const isEmptyResponse = /returned no content/i.test(message);

            if (!isEmptyResponse) {
                console.warn(`[AI] Model "${modelName}" failed: ${message}`);
            }

            const canFallback = modelsToTry.length > 1 && (isMissingModel || isEmptyResponse);
            if (!canFallback) {
                break;
            }

            console.warn(`Gemini model "${modelName}" unavailable (${message.trim()}), trying fallback...`);
        }
    }

    const details = lastError?.response?.data?.error?.message || lastError?.message || 'Unknown Gemini error';
    console.error('Gemini API error:', details);
    throw new Error(details);
}

async function invokeModel(modelName, prompt, { temperature, maxOutputTokens }) {
    const url = `${GEMINI_BASE_URL}/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const { data } = await axios.post(url, {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature,
            maxOutputTokens
        }
    }, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    const candidates = data.candidates || [];
    const text = candidates
        .flatMap(candidate => candidate.content?.parts || [])
        .map(part => part.text?.trim())
        .filter(Boolean)
        .join('\n')
        .trim();

    if (!text) {
        const finishReasons = candidates
            .map(candidate => candidate.finishReason)
            .filter(Boolean)
            .join(', ') || 'none reported';
        console.warn('[AI] Gemini returned no content for model:', modelName, 'raw payload:', JSON.stringify(data, null, 2));
        const error = new Error(`Gemini returned no content (finishReasons: ${finishReasons})`);
        error.rawResponse = data;
        throw error;
    }

    return text;
}

function buildSummaryPrompt(context) {
    const data = context.summaryPayload || {};
    const { totalsByType = {}, meta = {}, budgets = [], topCategories = [], largestSpends = [], netCashFlow, stats = {} } = data;

    const budgetLine = budgets.length
        ? budgets.map(b => `${b.categoryName}: budget ${formatCurrency(b.budget)}, actual ${formatCurrency(b.actual)} (${formatCurrency(b.variance)})`).join(' | ')
        : 'No budgets recorded.';

    const categoryLine = topCategories.length
        ? topCategories.map(cat => `${cat.categoryName} ${formatCurrency(cat.spend)} (${cat.shareOfSpend}% of spend)`).join(' | ')
        : 'No spending categories logged.';

    const spendsLine = largestSpends.length
        ? largestSpends.map(spend => `${spend.date}: ${formatCurrency(spend.amount)} on ${spend.categoryName}${spend.note ? ` (${spend.note})` : ''}`).join(' | ')
        : 'No large transactions recorded.';

    const compactData = [
        `Month: ${data.monthLabel || context.month}`,
        `Totals -> Spend: ${formatCurrency(totalsByType.spend)}, Save: ${formatCurrency(totalsByType.save)}, Invest: ${formatCurrency(totalsByType.invest)}`,
        `Net Cash Flow: ${formatCurrency(netCashFlow)}. Transactions: ${stats.transactionCount || 0}, Avg size: ${formatCurrency(stats.averageTransaction || 0)}`,
        `Meta -> Start balance: ${formatCurrency(meta.startBalance)}, Expected Income: ${formatCurrency(meta.expectedIncome)}, Expected Expense: ${formatCurrency(meta.expectedExpense)}, End estimate: ${formatCurrency(meta.endBalanceEstimate)}`,
        `Budgets vs Actuals: ${budgetLine}`,
        `Top Spend Categories: ${categoryLine}`,
        `Largest Purchases: ${spendsLine}`
    ].join('\n');

    return [
        'You are a friendly but direct personal finance coach.',
        'Analyze the monthly snapshot below and generate a concise review.',
        'Return:',
        '1. 1-sentence headline for the month.',
        '2. 2-3 bullet insights referencing the actual CAD amounts.',
        '3. Risks or warnings about budgets/cash flow (if any).',
        '4. 3 numbered action items tailored to the data.',
        'Keep under 200 words.',
        '',
        'SNAPSHOT:',
        compactData
    ].join('\n');
}

function formatCurrency(value) {
    const number = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    return `CAD ${number.toFixed(2)}`;
}

function buildAskPrompt({ question, current, previous }) {
    const payload = {
        question,
        currentMonth: current ? {
            month: current.month,
            totalsByType: current.totalsByType,
            netCashFlow: current.netCashFlow,
            meta: current.meta,
            categoryBreakdown: current.categoryBreakdown
        } : null,
        previousMonth: previous ? {
            month: previous.month,
            totalsByType: previous.totalsByType,
            netCashFlow: previous.netCashFlow,
            categoryBreakdown: previous.categoryBreakdown
        } : null
    };

    return [
        'You are an on-demand finance analyst. Use the JSON context to answer the user question.',
        'Guidelines:',
        '- Cite exact amounts from the data (e.g., "$420 spend on groceries").',
        '- If the data is missing for part of the question, say so plainly.',
        '- Compare current vs previous month when helpful.',
        '- Keep the tone supportive but realistic.',
        '- Limit to ~180 words.',
        '',
        'DATA CONTEXT:',
        JSON.stringify(payload, null, 2),
        '',
        `QUESTION: ${question}`
    ].join('\n');
}

function buildSuggestPrompt(note, categories) {
    const categoryList = categories.map(cat => `- ${cat.id}: ${cat.name}`).join('\n');
    return [
        'You help categorize personal finance transactions. Choose the best matching category id.',
        'If nothing fits, respond with the word UNKNOWN.',
        '',
        'CATEGORIES:',
        categoryList,
        '',
        `TRANSACTION NOTE: "${note}"`,
        '',
        'Respond with ONLY the category id (e.g., "gro1").'
    ].join('\n');
}

async function generateMonthlySummary(context) {
    const prompt = buildSummaryPrompt(context);
    return callGemini(prompt, { temperature: 0.3, maxOutputTokens: 800 });
}

async function answerFinanceQuestion(question, context) {
    const prompt = buildAskPrompt({ question, current: context.current, previous: context.previous });
    return callGemini(prompt, { temperature: 0.5, maxOutputTokens: 900 });
}

async function suggestCategory(note, categories) {
    const prompt = buildSuggestPrompt(note, categories);
    const raw = await callGemini(prompt, { temperature: 0.2, maxOutputTokens: 100 });
    const cleaned = raw.split(/[\s\n\r]+/).map(token => token.trim().replace(/[^a-zA-Z0-9_-]/g, '')).filter(Boolean);
    const normalized = cleaned.find(token => token && token !== 'UNKNOWN');
    const match = categories.find(cat => cat.id === normalized);
    return match ? match.id : null;
}

module.exports = {
    generateMonthlySummary,
    answerFinanceQuestion,
    suggestCategory
};
