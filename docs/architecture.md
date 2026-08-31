# Architecture

## Current setup

The project currently has three parts:

| Part     | Technology        | Purpose           |
| -------- | ----------------- | ----------------- |
| Client   | React + Vite      | Browser interface |
| Server   | Node.js + Express | API               |
| Database | MongoDB           | Data storage      |

The client and server run separately during development. The server connects to MongoDB.

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

In development, Vite proxies `/api` requests to the Express server. This lets the client use `/api/...` paths without putting the local server URL into individual components.

## Server structure

The server currently has a small structure around the application setup:

```text
server/src/
├── config/
├── controllers/
├── middleware/
├── routes/
├── utils/
├── app.js
└── index.js
```

The project will add domain-specific parts such as models and services when those features are implemented. They are not part of the M1 implementation.

## Health request

The current API includes a health endpoint used to check that the server is running and to report the current database connection state.

```text
GET /api/health
       |
       v
Express route
       |
       v
Health controller
       |
       v
JSON response
```

## M1 boundary

M1 only establishes the application foundation. It does not include:

* authentication
* business data models
* catalogue functionality
* loan functionality
* dashboard or alerts
* bulk operations
* deployment configuration

The architecture will be updated when later modules introduce new components or change existing boundaries.
