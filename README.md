# FinanceMan - Personal Finance Manager

A modern, responsive personal finance app built with Node.js, Express, Chart.js, Tailwind utilities, and vanilla JS. All data lives locally in JSON files for privacy and simplicity.

## Features

- 📊 Insightful dashboard with charts, hero metrics, and page-specific panels  
- ⚡ Global Quick Add button + `Shift + A` shortcut for instant transaction logging  
- 🔥 Weekly Peek and daily streak chip to keep habits intact  
- 🎉 Micro-celebrations (confetti) after every logged transaction  
- 🎯 Goal tracker cards with editable targets  
- 🔔 Browser notifications for streak reminders & upcoming bills  
- 🏦 Multi-account management with inline balance editing  
- 🏷️ Color-coded categories and smart budgeting controls  
- 📁 Archive explorer with collapsible monthly history  
- 🌓 Light/dark mode, fully responsive layout, CSV import/export, and more

## Tech Stack

- Backend: Node.js + Express  
- Frontend: HTML + Tailwind CSS + vanilla JS  
- Charts: Chart.js  
- Storage: Local JSON files (no external DBs)

## Setup

```bash
git clone <repository-url>
cd financeman
npm install
npm start
# open http://localhost:3000
```

> Note: FinanceMan stores everything in local JSON files. It’s designed to run on your machine (localhost) rather than a shared hosting environment.

For live reloading during development:

```bash
npm run dev
```

## Build Notes

- Crafted over a chill weekend (~6 focused hours) with endless lofi + coffee.  
- Proudly built with help from OpenAI’s ChatGPT (GPT‑4 class) for ideation and speed boosts.  
- Vibe code: “Track your stuff, celebrate the wins, keep it simple.”

## License

MIT
