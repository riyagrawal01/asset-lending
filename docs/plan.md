# Plan

## Work sessions

I divided the project into seven sessions so that each session would leave the project in a usable state before moving to the next part.

The order is:

1. Foundation
2. Database schema
3. Authentication and roles
4. Catalogue and custodians
5. Loans and loan lifecycle
6. Search, bulk operations and dashboard
7. Alerts, testing and final setup

I started with the foundation because the rest of the application depends on having the client, server and database connection working. The schema comes next because the later features depend on it. Authentication is added before the application features so that access rules can be built into the APIs from the beginning.

The catalogue and lending features are kept separate because lending is the main business workflow and depends on the catalogue. Search, bulk operations and the dashboard are built after the lending workflow so they can use the actual loan data. Alerts and final testing are left until the end.

I will record changes to this plan if the implementation requires them.

---

## M1 — Foundation

**Scope**

Set up the basic client and server application, configuration, MongoDB connection, health endpoint and development tooling.

**What I planned to do**

* Set up the client and server
* Configure the development environment
* Set up the MongoDB connection
* Add the health endpoint
* Add basic error handling
* Set up the Vite development proxy
* Add the basic API client
* Add development scripts
* Verify that the application starts and builds correctly

### Result

M1 was completed. The client and server run independently, the development setup works, and the health endpoint was verified.


---

## M02 — Data Model

**Scope:** Define the database models, relationships, indexes, and validation needed for the core lending data.

**What I worked on:**

1. Added the five Mongoose models: User, Item, Loan, LoanEvent, and ItemCustodian.
2. Added the references between users, items, loans, events, and custodians.
3. Added the required unique constraints and indexes based on the expected queries.
4. Kept `OVERDUE` as a derived condition instead of a stored loan status.
5. Kept loan events separate so the loan timeline can remain append-only.
6. Added the model constants and shared model exports.


---

### M03 — Authentication

**Scope:** Registration, login, JWT authentication, role-based access, and client-side token handling.

**What I worked on:**

1. Added the JWT secret to the existing environment configuration.
2. Added the authentication service for registration and login, including password hashing and JWT creation.
3. Added authentication middleware to verify tokens and identify the logged-in user.
4. Added role checking so librarian-only operations can be enforced on the server.
5. Added the authentication controller and routes for registration, login, and the current-user endpoint.
6. Connected the new authentication routes to the existing Express application.
7. Added simple client-side token handling using `localStorage` and attached the token to authenticated API requests.
8. Added the client authentication API for registration, login, fetching the current user, and logout.


---

*Later modules will be recorded here as they are completed.*