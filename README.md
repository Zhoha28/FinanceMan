# FinanceMan - Personal Finance Manager

A modern, responsive personal finance management web application built with Node.js, Express, Tailwind CSS, and Chart.js. All data is stored locally in JSON files for privacy and simplicity.

## Features

- 📊 Interactive dashboard with financial summaries and charts
- 💰 Track spending, saving, and investments
- 📅 Monthly budgeting with progress tracking
- 🏦 Multiple account management
- 🏷️ Customizable categories with color coding
- 📈 Visual insights and smart alerts
- 🌓 Dark/light theme support
- 📱 Fully responsive design
- 📤 CSV import/export
- 📂 Local JSON file storage
- 🔄 Month-over-month tracking

## Tech Stack

- Backend: Node.js + Express
- Frontend: HTML + Tailwind CSS + Vanilla JS
- Charts: Chart.js
- Storage: Local JSON files
- No external databases or APIs required

## Setup

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
cd financeman
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Start the server:
\`\`\`bash
npm start
\`\`\`

4. Open in your browser:
\`\`\`
http://localhost:3000
\`\`\`

## Data Structure

The app uses five main JSON files for data storage:

- \`data/transactions.json\`: All financial transactions
- \`data/accounts.json\`: Account configurations
- \`data/categories.json\`: Spending/saving categories
- \`data/budgets.json\`: Monthly budgets per category
- \`data/meta.json\`: Monthly metadata (balances, expectations)

## Development

To run in development mode with auto-reload:

\`\`\`bash
npm run dev
\`\`\`

## License

MIT