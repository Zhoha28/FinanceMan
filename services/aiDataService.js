const db = require('../db/jsonStore');

function formatMonthLabel(month) {
    if (!month) return '';
    const date = new Date(`${month}-01T00:00:00Z`);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });
}

function getPreviousMonth(month) {
    if (!month) return null;
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return date.toISOString().slice(0, 7);
}

function round(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

async function loadBaseData() {
    const [transactions, categories, budgets, meta] = await Promise.all([
        db.readJson('transactions.json').then(data => data || []),
        db.readJson('categories.json').then(data => data || []),
        db.readJson('budgets.json').then(data => data || {}),
        db.readJson('meta.json').then(data => data || {})
    ]);

    return { transactions, categories, budgets, meta };
}

function buildSnapshot(month, data) {
    if (!month) {
        return null;
    }

    const { transactions, categories, budgets, meta } = data;
    const monthTransactions = transactions.filter(tx =>
        typeof tx.date === 'string' && tx.date.startsWith(month)
    );

    const totalsByType = monthTransactions.reduce((acc, tx) => {
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'spend') acc.spend += amount;
        if (tx.type === 'save') acc.save += amount;
        if (tx.type === 'invest') acc.invest += amount;
        acc.total += amount;
        return acc;
    }, { spend: 0, save: 0, invest: 0, total: 0 });

    const categoriesById = categories.reduce((acc, cat) => {
        acc[cat.id] = cat;
        return acc;
    }, {});

    const breakdownMap = {};
    monthTransactions.forEach(tx => {
        const amount = Number(tx.amount) || 0;
        const entry = breakdownMap[tx.category] || {
            categoryId: tx.category,
            categoryName: categoriesById[tx.category]?.name || tx.category,
            totals: { spend: 0, save: 0, invest: 0 },
            totalAmount: 0,
            transactionCount: 0
        };
        if (tx.type === 'spend') entry.totals.spend += amount;
        if (tx.type === 'save') entry.totals.save += amount;
        if (tx.type === 'invest') entry.totals.invest += amount;
        entry.totalAmount += amount;
        entry.transactionCount += 1;
        breakdownMap[tx.category] = entry;
    });

    const totalSpend = totalsByType.spend || 0;
    const categoryBreakdown = Object.values(breakdownMap).map(entry => ({
        ...entry,
        totals: {
            spend: round(entry.totals.spend),
            save: round(entry.totals.save),
            invest: round(entry.totals.invest)
        },
        totalAmount: round(entry.totalAmount),
        shareOfSpend: totalSpend ? round((entry.totals.spend / totalSpend) * 100) : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const budgetsForMonth = budgets[month] || {};
    const budgetComparisons = Object.entries(budgetsForMonth).map(([categoryId, budgetAmount]) => {
        const actualSpend = breakdownMap[categoryId]?.totals.spend || 0;
        return {
            categoryId,
            categoryName: categoriesById[categoryId]?.name || categoryId,
            budget: round(budgetAmount),
            actual: round(actualSpend),
            variance: round(actualSpend - budgetAmount)
        };
    }).sort((a, b) => b.variance - a.variance);

    const metaForMonth = meta[month] || {};
    const netCashFlow = round(totalsByType.save + totalsByType.invest - totalsByType.spend);
    const endBalanceEstimate = typeof metaForMonth.startBalance === 'number'
        ? round(Number(metaForMonth.startBalance) + netCashFlow)
        : null;

    const largestSpends = monthTransactions
        .filter(tx => tx.type === 'spend')
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .slice(0, 5)
        .map(tx => ({
            date: tx.date,
            amount: round(tx.amount),
            categoryId: tx.category,
            categoryName: categoriesById[tx.category]?.name || tx.category,
            note: tx.notes || ''
        }));

    const compactTopCategories = categoryBreakdown
        .filter(entry => entry.totals.spend > 0)
        .slice(0, 5)
        .map(entry => ({
            categoryName: entry.categoryName,
            spend: round(entry.totals?.spend || 0),
            shareOfSpend: entry.shareOfSpend
        }));

    const compactBudgets = budgetComparisons
        .filter(entry => entry.budget > 0 || entry.actual > 0)
        .slice(0, 3)
        .map(entry => ({
            categoryName: entry.categoryName,
            budget: entry.budget,
            actual: entry.actual,
            variance: entry.variance
        }));

    const compactSpends = largestSpends
        .slice(0, 3)
        .map(spend => ({
            date: spend.date,
            amount: spend.amount,
            categoryName: spend.categoryName,
            note: spend.note
        }));

    return {
        month,
        monthLabel: formatMonthLabel(month),
        hasData: monthTransactions.length > 0,
        totalsByType: {
            spend: round(totalsByType.spend),
            save: round(totalsByType.save),
            invest: round(totalsByType.invest),
            total: round(totalsByType.total)
        },
        categoryBreakdown,
        budgetComparisons,
        meta: {
            startBalance: typeof metaForMonth.startBalance === 'number' ? Number(metaForMonth.startBalance) : null,
            expectedIncome: typeof metaForMonth.expectedIncome === 'number' ? Number(metaForMonth.expectedIncome) : null,
            expectedExpense: typeof metaForMonth.expectedExpense === 'number' ? Number(metaForMonth.expectedExpense) : null,
            endBalanceEstimate
        },
        netCashFlow,
        transactionHighlights: largestSpends,
        stats: {
            transactionCount: monthTransactions.length,
            averageTransaction: monthTransactions.length ? round(totalsByType.total / monthTransactions.length) : 0
        },
        totals: {
            byCategory: categoryBreakdown,
            byType: {
                spend: round(totalsByType.spend),
                save: round(totalsByType.save),
                invest: round(totalsByType.invest)
            }
        },
        summaryPayload: {
            monthLabel: formatMonthLabel(month),
            totalsByType: {
                spend: round(totalsByType.spend),
                save: round(totalsByType.save),
                invest: round(totalsByType.invest)
            },
            netCashFlow,
            meta: {
                startBalance: typeof metaForMonth.startBalance === 'number' ? Number(metaForMonth.startBalance) : null,
                expectedIncome: typeof metaForMonth.expectedIncome === 'number' ? Number(metaForMonth.expectedIncome) : null,
                expectedExpense: typeof metaForMonth.expectedExpense === 'number' ? Number(metaForMonth.expectedExpense) : null,
                endBalanceEstimate
            },
            budgets: compactBudgets,
            topCategories: compactTopCategories,
            largestSpends: compactSpends,
            stats: {
                transactionCount: monthTransactions.length,
                averageTransaction: monthTransactions.length ? round(totalsByType.total / monthTransactions.length) : 0
            }
        }
    };
}

async function getMonthContext(month) {
    const baseData = await loadBaseData();
    const snapshot = buildSnapshot(month, baseData);
    return {
        ...snapshot,
        categories: baseData.categories.map(({ id, name }) => ({ id, name }))
    };
}

async function getComparisonContext(month) {
    const baseData = await loadBaseData();
    const previousMonth = getPreviousMonth(month);
    return {
        current: buildSnapshot(month, baseData),
        previous: buildSnapshot(previousMonth, baseData),
        previousMonth,
        categories: baseData.categories.map(({ id, name }) => ({ id, name }))
    };
}

async function getCategoryList() {
    const categories = await db.readJson('categories.json') || [];
    return categories.map(({ id, name }) => ({ id, name }));
}

module.exports = {
    getMonthContext,
    getComparisonContext,
    getCategoryList,
    getPreviousMonth
};
