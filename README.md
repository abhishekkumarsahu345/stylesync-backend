# StyleSync Backend

Backend API for StyleSync — extracts website design tokens, stores design data, manages version history, and exports CSS variables.

## Tech Stack

* Node.js
* Express.js
* PostgreSQL (Neon)
* Playwright

## Setup Instructions

1. Clone repository

2. Install dependencies:
   npm install

3. Add environment variables:
   PORT=5000
   DATABASE_URL=your_database_url

4. Start development server:
   npm run dev

## API Endpoints

* POST /api/scrape
* GET /api/tokens/:siteId
* POST /api/tokens/:siteId/lock
* GET /api/history/:siteId
* GET /api/export/:siteId/css
