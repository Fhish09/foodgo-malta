# FoodGo Malta API

Backend for the FoodGo Malta food delivery platform.

## Stack

- Node.js + Express
- SQLite via Node.js built-in `node:sqlite` (Node 22+) — no native build tools needed
- JWT auth with roles: `customer`, `restaurant`, `admin`

## Setup

```bash
cd backend
npm install
copy .env.example .env   # Windows
npm run seed
npm run dev
```

Requires **Node.js 22 or newer** (you have 24 — fine).

API: **http://localhost:4000**

## Demo accounts

| Role     | Email                      | Password     |
|----------|----------------------------|--------------|
| Admin    | admin@foodgo.mt            | admin123     |
| Owner    | owner@vallettapizza.mt     | owner123     |
| Customer | customer@example.com       | customer123  |

## Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Register |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/restaurants` | — | List restaurants |
| GET | `/api/restaurants/:id` | — | Restaurant + menu |
| POST | `/api/orders` | customer | Place order |
| GET | `/api/orders/mine` | customer | My orders |
| GET | `/api/orders/:id` | auth | Order detail |
| PATCH | `/api/orders/:id/status` | restaurant/admin | Update status |
| GET | `/api/orders/restaurant/incoming` | restaurant | Incoming orders |
