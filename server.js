require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const db = require('./db/jsonStore');
const { getMonthContext, getComparisonContext, getCategoryList } = require('./services/aiDataService');
const { generateMonthlySummary, answerFinanceQuestion, suggestCategory } = require('./services/geminiClient');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// AI endpoints
app.post('/api/ai/summary', async (req, res) => {
    const { month } = req.body || {};
    if (!month) {
        return res.status(400).json({ error: 'Month is required.' });
    }

    try {
        const context = await getMonthContext(month);
        if (!context || !context.hasData) {
            return res.status(404).json({ message: 'No transactions found for this month. Add some data first.' });
        }

        console.log('[AI][summary] Context snapshot:', {
            month,
            totalsByType: context?.summaryPayload?.totalsByType,
            budgetCount: context?.summaryPayload?.budgets?.length,
            topCategories: context?.summaryPayload?.topCategories?.map(cat => ({
                categoryName: cat.categoryName,
                spend: cat.totals?.spend
            }))
        });

        const summary = await generateMonthlySummary(context);
        res.json({ summary, month, generatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('AI summary error:', err.message || err);
        res.status(500).json({ error: 'Failed to generate AI summary. Please try again later.' });
    }
});

app.post('/api/ai/ask', async (req, res) => {
    const { month, question } = req.body || {};
    const sanitizedQuestion = typeof question === 'string' ? question.trim() : '';
    if (!month) {
        return res.status(400).json({ error: 'Month is required.' });
    }
    if (!sanitizedQuestion) {
        return res.status(400).json({ error: 'A question is required.' });
    }

    try {
        const context = await getComparisonContext(month);
        const hasData = (context.current && context.current.hasData) || (context.previous && context.previous.hasData);
        if (!hasData) {
            return res.status(404).json({ message: 'Not enough data to answer yet. Add some transactions first.' });
        }

        console.log('[AI][ask] Incoming question:', {
            month,
            question: sanitizedQuestion,
            currentTotals: context.current?.totalsByType,
            previousTotals: context.previous?.totalsByType
        });

        const answer = await answerFinanceQuestion(sanitizedQuestion, context);
        res.json({
            answer,
            month: context.current?.month,
            previousMonth: context.previous?.month,
            generatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('AI ask error:', err.message || err);
        res.status(500).json({ error: 'Failed to answer the question. Please try again later.' });
    }
});

app.post('/api/ai/suggest-category', async (req, res) => {
    const { note, categories } = req.body || {};
    if (!note || !note.trim()) {
        return res.status(400).json({ error: 'A note/description is required.' });
    }

    try {
        const availableCategories = Array.isArray(categories) && categories.length
            ? categories
            : await getCategoryList();

        if (!availableCategories.length) {
            return res.status(400).json({ error: 'No categories available to match.' });
        }

        const categoryId = await suggestCategory(note, availableCategories);
        res.json({ categoryId });
    } catch (err) {
        console.error('AI suggest category error:', err.message || err);
        res.status(500).json({ error: 'Failed to suggest a category. Please try again later.' });
    }
});

// Endpoints for transactions
app.get('/api/entries', async (req, res) => {
    try {
        const { month } = req.query;
        const transactions = await db.readJson('transactions.json') || [];
        if (month) {
            return res.json(transactions.filter(t => t.date.startsWith(month)));
        }
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/entries', async (req, res) => {
    try {
        const entry = {
            id: generateId(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        await db.appendToArray('transactions.json', [entry]);
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/entries/:id', async (req, res) => {
    try {
        const updated = await db.updateById('transactions.json', req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/entries/:id', async (req, res) => {
    try {
        await db.deleteById('transactions.json', req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints for accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await db.readJson('accounts.json') || [];
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', async (req, res) => {
    try {
        const account = {
            id: generateId(),
            ...req.body
        };
        await db.appendToArray('accounts.json', [account]);
        res.status(201).json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/accounts/:id', async (req, res) => {
    try {
        const updated = await db.updateById('accounts.json', req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', async (req, res) => {
    try {
        await db.deleteById('accounts.json', req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints for budgets
app.get('/api/budgets/:month', async (req, res) => {
    try {
        const budgets = await db.readJson('budgets.json') || {};
        res.json(budgets[req.params.month] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/budgets/:month', async (req, res) => {
    try {
        const budgets = await db.readJson('budgets.json') || {};
        budgets[req.params.month] = req.body;
        await db.writeJson('budgets.json', budgets);
        res.json(budgets[req.params.month]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints for categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await db.readJson('categories.json') || [];
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const category = {
            id: generateId(),
            ...req.body
        };
        await db.appendToArray('categories.json', [category]);
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/categories/:id', async (req, res) => {
    try {
        const updated = await db.updateById('categories.json', req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        await db.deleteById('categories.json', req.params.id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints for meta data
app.get('/api/meta/:month', async (req, res) => {
    try {
        const meta = await db.readJson('meta.json') || {};
        res.json(meta[req.params.month] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/meta/:month', async (req, res) => {
    try {
        const meta = await db.readJson('meta.json') || {};
        meta[req.params.month] = req.body;
        await db.writeJson('meta.json', meta);
        res.json(meta[req.params.month]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CSV Import/Export
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/import', upload.single('file'), async (req, res) => {
    try {
        const records = [];
        const parser = parse({ columns: true, skip_empty_lines: true });
        
        parser.on('readable', function() {
            let record;
            while ((record = parser.read()) !== null) {
                records.push({
                    id: generateId(),
                    ...record,
                    createdAt: new Date().toISOString()
                });
            }
        });

        parser.on('end', async function() {
            await db.appendToArray('transactions.json', records);
            res.json({ message: `Imported ${records.length} entries` });
        });

        parser.write(req.file.buffer.toString());
        parser.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/export', async (req, res) => {
    try {
        const transactions = await db.readJson('transactions.json') || [];
        stringify(transactions, { header: true }, (err, output) => {
            if (err) throw err;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=transactions-export.csv');
            res.send(output);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize default data if not exists
async function initializeDefaultData() {
    // Default categories
    const defaultCategories = [
        { id: generateId(), name: 'Cat', color: '#FF6B6B' },
        { id: generateId(), name: 'Uber', color: '#4ECDC4' },
        { id: generateId(), name: 'Grocery', color: '#45B7D1' },
        { id: generateId(), name: 'Restaurant', color: '#96CEB4' },
        { id: generateId(), name: 'Shopping', color: '#FFEEAD' },
        { id: generateId(), name: 'Mobile Bill', color: '#D4A5A5' },
        { id: generateId(), name: 'Tenant Insurance', color: '#9799BA' },
        { id: generateId(), name: 'Miscellaneous', color: '#A8E6CE' },
        { id: generateId(), name: 'TTC', color: '#FF8C94' },
        { id: generateId(), name: 'Gym', color: '#A8E6CF' }
    ];

    // Default accounts
    const defaultAccounts = [
        { id: generateId(), name: 'Cash in hand', currency: 'CAD', classification: 'cash', balances: {} },
        { id: generateId(), name: 'Scotiabank checking', currency: 'CAD', classification: 'savings', balances: {} },
        { id: generateId(), name: 'Wealthsimple checking', currency: 'CAD', classification: 'savings', balances: {} },
        { id: generateId(), name: 'Wealthsimple TFSA', currency: 'CAD', classification: 'investment', balances: {} },
        { id: generateId(), name: 'Wealthsimple RRSP', currency: 'CAD', classification: 'investment', balances: {} },
        { id: generateId(), name: 'Wealthsimple FHSA', currency: 'CAD', classification: 'investment', balances: {} },
        { id: generateId(), name: 'Wealthsimple Crypto', currency: 'CAD', classification: 'investment', balances: {} },
        { id: generateId(), name: 'Zerodha', currency: 'INR→CAD', classification: 'investment', balances: {} },
        { id: generateId(), name: 'Coin', currency: 'INR→CAD', classification: 'investment', balances: {} }
    ];

    if (!(await db.readJson('categories.json'))) {
        await db.writeJson('categories.json', defaultCategories);
    }

    if (!(await db.readJson('accounts.json'))) {
        await db.writeJson('accounts.json', defaultAccounts);
    }
}

// Initialize data and start server
initializeDefaultData().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(console.error);
