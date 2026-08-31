# FoodGo Malta API

Backend for the FoodGo Malta food delivery platform.

## Stack

- Node.js + Express
- SQLite (better-sqlite3) — easy local start; can switch to Postgres later
- JWT auth with roles: `customer`, `restaurant`, `admin`

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run seed    # creates DB + sample Malta restaurants
npm run dev     # http://localhost:4000
```

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
| POST | `/api/auth/register` | — | Register (customer/restaurant) |
| POST | `/api/auth/login` | — | Login → JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/restaurants` | — | List (filter: category, town, q) |
| GET | `/api/restaurants/:id` | — | Restaurant + menu |
| POST | `/api/orders` | customer | Place order |
| GET | `/api/orders/mine` | customer | My orders |
| GET | `/api/orders/:id` | auth | Order detail |
| PATCH | `/api/orders/:id/status` | restaurant/admin | Update status |
| GET | `/api/orders/restaurant/incoming` | restaurant | Incoming orders |

## Order statuses

`placed` → `accepted` → `courier_assigned` → `on_the_way` → `delivered`  
(also: `rejected`, `cancelled`)
