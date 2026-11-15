# Sonelia — Backend (API)

REST API for **Sonelia**, a multi-tenant SaaS for health clinics (psychology, physiotherapy, speech therapy, aesthetics, medical and more). It handles scheduling, patients, confidential medical records, assessments, professional payouts, subscriptions and WhatsApp reminders.

> The project was formerly called **Software Clinic**. The repository and folder names (`softwareclinic-backend`) were kept.

![Node](https://img.shields.io/badge/node-26.13.1-339933?logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify)
![MongoDB](https://img.shields.io/badge/mongodb-mongoose_9-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-private-lightgrey)

## Demo

- **API (production):** https://api.sonelia.com.br/api
- **Web app:** https://sonelia.com.br (frontend in [`softwareclinic-frontend`](../softwareclinic-frontend))

## Features

- **Authentication:** email/password (argon2 + JWT) and Google sign-in, password recovery, welcome email.
- **Multi-tenant:** every document carries a `tenantId`; each clinic only sees its own data.
- **Roles:** `super_admin`, `admin` (clinic owner), `profissional` (health professional), `recepcao` (front desk) and `afiliado` (affiliate).
- **Scheduling:** appointments, rooms, services (single or session packages), health plans with co-payment, waiting list and meetings.
- **Patients and medical records:** confidential records with access rules and audit log; only the patient's health professional can open them.
- **Clinical forms:** anamnesis templates, neuropsychological assessment, NR-01 assessment and informed consent forms (TCLE) signed by the patient.
- **Finance:** payment per appointment or per series of sessions (upfront or in instalments) and professional payouts (commissions).
- **Subscriptions:** plans with free trial, payments through Mercado Pago (Brazil) and Stripe (other countries), expiration notices, referral program and affiliates.
- **WhatsApp reminders:** automatic appointment reminders through the WhatsApp Cloud API.
- **Waiting room:** patient call and TV panel.
- **Receipt printing:** thermal printer support.
- **Three languages:** API messages in Portuguese, English and Spanish, chosen by the `Accept-Language` header.

## Tech stack

| Area | Technology |
|---|---|
| Runtime | Node.js 26 (ES modules) |
| Framework | Fastify 5 + `@fastify/cors` |
| Database | MongoDB Atlas + Mongoose 9 |
| Auth | argon2, jsonwebtoken, google-auth-library |
| Payments | Mercado Pago, Stripe |
| Email | Resend |
| Messaging | WhatsApp Cloud API, Telegram (internal alerts) |
| Others | sharp (images), node-thermal-printer, nodemon |

## Prerequisites

- **Node.js 26.13.1** (see `.nvmrc`; with nvm, run `nvm use`)
- **npm**
- Access to a **MongoDB Atlas** cluster
- Optional, depending on what you test: Mercado Pago, Stripe, Resend, WhatsApp and Telegram credentials

## Installation

```bash
git clone <repository-url> softwareclinic-backend
cd softwareclinic-backend
nvm use
npm install
```

Create a `.env` file in the project root (see the next section) and start the server:

```bash
npm start
```

The API runs at `http://localhost:8080/api` (or on the port set in `PORT`).

> ⚠️ **Warning:** use a test database in your `.env`. Never point a local environment at the production database without care.

## Configuration (environment variables)

Never commit the `.env` file. Use placeholder values only in documentation.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default `8080`) |
| `NODE_ENV` | No | `production` enables jobs that change data (expiration notices, data backfills) |
| `MONGODB_USERNAME` | Yes | MongoDB Atlas user |
| `MONGODB_PASSWORD` | Yes | MongoDB Atlas password |
| `JWT_SECRET` | Yes | Secret used to sign the tokens |
| `APP_URL` | Yes | Frontend URL (used in emails and payment redirects) |
| `APP_URL_BACKEND` | No | Public API URL (used in payment webhooks) |
| `GOOGLE_CLIENT_ID` | No | Google sign-in client ID |
| `RESEND_API_KEY` | No | Resend key for sending emails |
| `EMAIL_REMETENTE` | No | Sender address for emails |
| `MP_ACCESS_TOKEN` | No | Mercado Pago access token |
| `MP_WEBHOOK_SECRET` | No | Mercado Pago webhook signature secret |
| `MP_API_URL` | No | Mercado Pago API base URL |
| `MP_TEST_PAYER_EMAIL` | No | Test buyer email (Mercado Pago sandbox) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature secret |
| `WHATSAPP_TOKEN` | No | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | Sender phone number ID |
| `WHATSAPP_API_URL` / `WHATSAPP_API_VERSION` | No | WhatsApp Graph API URL and version |
| `WHATSAPP_TEMPLATE_LEMBRETE` | No | Approved reminder template name |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` | No | WhatsApp webhook verification and signature |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | No | Internal alerts (e.g. new clinic sign-ups) |
| `PRINTER_MODE` / `PRINTER_NAME` / `PRINTER_INTERFACE` | No | Thermal printer settings |

Example:

```env
PORT=8080
MONGODB_USERNAME=your-user
MONGODB_PASSWORD=your-password
JWT_SECRET=a-long-random-string
APP_URL=http://localhost:5173
```

## Usage

### Scripts

| Command | Description |
|---|---|
| `npm start` | Starts the API with nodemon (reloads on file changes) |
| `node scripts/seedPlanos.js` | Creates the default subscription plans (skips the ones that already exist) |

### Response format

Every route lives under `/api` and returns:

```json
{ "success": true, "data": {}, "message": "..." }
```

Errors return `success: false` and the proper HTTP status (`400`, `401`, `403`, `404`, `402` for an expired subscription...).

### Authentication

Send the token in the header:

```http
Authorization: Bearer <token>
Accept-Language: en
```

### Main routes

| Module | Example |
|---|---|
| Users / login | `POST /api/users/login`, `GET /api/users/me` |
| Patients | `/api/pacientes` |
| Appointments | `/api/agendas` |
| Medical records | `/api/prontuarios` |
| Professionals | `/api/profissionais` |
| Services, rooms, health plans | `/api/servicos`, `/api/salas`, `/api/convenios` |
| Subscriptions | `GET /api/assinaturas/atual`, `POST /api/assinaturas/checkout` |
| Webhooks | `POST /api/assinaturas/webhook` (Mercado Pago), `POST /api/assinaturas/stripe/webhook`, `/api/whatsapp/webhook` |

The full list of routes is in each module's `*.routes.js` file.

## Folder structure

```
softwareclinic-backend/
├── index.js              # Fastify setup, CORS, error handler, module registration and jobs
├── scripts/              # One-off scripts (seeds, migrations)
└── src/
    ├── config/           # Mercado Pago and Stripe clients
    ├── db/               # MongoDB connection
    ├── errors/           # AppError(message, status)
    └── modules/
        ├── <entity>/     # One folder per entity (MVC)
        │   ├── <entity>.model.js
        │   ├── <entity>.dto.js
        │   ├── <entity>.service.js      # business rules
        │   ├── <entity>.controller.js
        │   └── <entity>.routes.js
        └── shared/
            ├── middlewares/ # authenticate, authorize, active subscription
            └── utils/       # email, telegram, language, translated messages, dates
```

To add a new module, create its folder in `src/modules/` and register the routes in `index.js`:

```js
await fastify.register(xRoutes, { prefix: '/api' })
```

## Deployment

- Runs in a **Docker** container on an **OVH VPS**, behind **Caddy** (HTTPS), at `https://api.sonelia.com.br`.
- The server has its own `.env` with the production variables.
- Update the server after pushing to `main`:

```bash
~/atualizar.sh sonelia
```

- Payment and WhatsApp webhooks must point to the public API URL.

## Contributing

1. Create a branch from `main`: `feature/<name>` (or `fix/<name>`).
2. Follow the module pattern (model, dto, service, controller, routes) and keep business rules in the service.
3. Every query must filter by `tenantId`.
4. Every new API message needs its English and Spanish translation in `src/modules/shared/utils/mensagens.en.js` and `mensagens.es.js`.
5. Write commit messages in Portuguese.
6. Open a pull request to `main`.

## License and author

**Private and proprietary.** All rights reserved. Copying, distribution or use without authorization is not allowed.

Developed by **Stanley Andrade**.
