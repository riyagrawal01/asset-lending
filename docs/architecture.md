# Architecture

## Current setup

The project has three main parts:

| Part     | Technology        | Purpose                   |
| -------- | ----------------- | ------------------------- |
| Client   | React + Vite      | Browser interface         |
| Server   | Node.js + Express | API and application logic |
| Database | MongoDB           | Data storage              |

The client and server run separately during development. The server connects to MongoDB using Mongoose.

## Communication

```text
React client
    |
    | HTTP / JSON
    v
Express API
    |
    | Mongoose
    v
MongoDB
```

During development, Vite proxies `/api` requests to the Express server. The client can therefore use paths such as `/api/auth/login` without putting the server URL into individual API calls.

## Server structure

```text
server/src/

├── config/          — environment and database configuration
├── controllers/     — request handlers
├── middleware/      — authentication and shared middleware
├── models/          — Mongoose schemas
├── routes/          — API routes
├── services/        — application logic
├── utils/           — shared helpers
├── app.js           — Express application setup
└── index.js         — server entry point
```

The main parts are separated by responsibility. Routes define the API endpoints, controllers handle requests, services contain application logic, and models handle the database structure.

## Data model

The main models are:

```text
User
Item
Loan
LoanEvent
ItemCustodian
```

The main relationships are:

```text
User ───────< Loan >────── Item
                  |
                  v
              LoanEvent

User >──────< Item
     custodians
```

`ItemCustodian` handles the many-to-many relationship between librarians and catalogue items.

## Authentication

Authentication uses JWTs. Protected requests include the token in the `Authorization` header.

```text
Login
  |
  v
auth route
  |
  v
auth controller
  |
  v
auth service
  |
  ├── find user
  ├── verify password
  └── create JWT
  |
  v
Token returned to client
```

For protected requests, the authentication middleware verifies the token and identifies the current user. Role checks are applied where an endpoint requires a specific role.

The client currently stores the JWT in `localStorage`, and the shared API client adds it to authenticated requests.
