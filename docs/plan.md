# Plan

## Work sessions

I divided the project into seven sessions so that each session would leave the project in a usable state before moving to the next part.

The order is:

1. Foundation
2. Database schema
3. Authentication and roles
4. Catalogue and custodians
5. Loans and loan lifecycle
6. Search, bulk operations, dashboard, alerts.
7. Admin role and its features.
8. Alerts, testing and final setup

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

### M04 — Catalogue

**Scope:** Catalogue management with role-based access. This includes the server service, controller and routes, along with the client API and catalogue UI. Added 26 tests for the catalogue functionality.

**What was added:**

1. `services/itemService.js` — added the main catalogue operations: list, get, create, update, archive and restore. Duplicate item codes are checked before creation so the API can return a clear error.

2. `controllers/itemController.js` — kept the controllers thin and delegated the catalogue operations to the service.

3. `routes/items.js` — added the catalogue endpoints. `/archived` is defined before `/:id` so it is handled as a specific route.

4. `app.js` — mounted the catalogue routes under `/api/items`.

5. `client/src/api/itemsApi.js` — added the client-side functions for the catalogue endpoints.

6. `client/src/features/LoginRegister.jsx` — added the login and registration UI. Registration creates the account without automatically logging the user in.

7. `client/src/features/ItemFormModal.jsx` — created a shared form for both adding and editing items.

8. `client/src/features/CataloguePage.jsx` — added the catalogue view. Members have read-only access while librarians can add, edit, archive and restore items.

9. `client/src/app/catalogue.css` — added the styles for the catalogue, forms, modal and related UI.

10. `client/src/app/App.jsx` — connected the authentication state with the main application view, showing the login screen when there is no authenticated user and the catalogue when there is.

**Result:** Catalogue management is now available through the API and client, with librarian actions protected on the server and archived items kept separate from the default catalogue view.

---

### M05 — Loans

**Scope:** Added the loan lifecycle from requesting an item through issuing, returning, or marking it lost. The module also handles item availability and concurrent issue attempts.

**What was added:**

1. `models/Loan.js` — added a partial unique index so an item can have only one open loan (`REQUESTED` or `ISSUED`) at a time.

2. `services/loanService.js` — implemented the loan lifecycle and its validation. Loan changes and their `LoanEvent` records are handled together using MongoDB transactions. Duplicate-key conflicts are converted into a clear item-unavailable error.

3. `controllers/loanController.js` and `routes/loans.js` — added the loan endpoints and applied the existing role-based access control.

4. `__tests__/loans.test.js` — added tests for the lifecycle, permissions, loan events, availability rules, and concurrent issue handling. MongoDB transactions are mocked in the test environment because the current `mongodb-memory-server` setup does not reliably support transactions.

5. `client/src/api/loansApi.js` — added the API functions used by the client.

6. `client/src/features/LoansPage.jsx` — added the initial loans view with the actions needed for members and librarians.

7. `client/src/features/CataloguePage.jsx` — added the option for members to request an item.

8. `client/src/app/App.jsx` — added navigation between the Catalogue and Loans views.


---
### M06 — Search, Bulk Operations, Dashboard, Alerts

**Scope:** Server-side loan search, filtering and pagination; bulk loan returns; dashboard aggregations; overdue alerts; CSV catalogue import; and CSV export of currently on-loan items.

**What was added:**

1. `services/loanService.js` — extended loan functionality with server-side search/filtering/pagination, bulk returns, loan history, and overdue alerts. Bulk returns reuse the existing return lifecycle so validation and `LoanEvent` creation remain consistent.

2. `services/dashboardService.js` — added MongoDB aggregations for dashboard statistics, loan status breakdown, custodian breakdown, and the eight-week return trend. Calculations remain on the server.

3. `services/itemService.js` — added CSV catalogue import with row-level validation and partial success, plus server-side CSV export of currently on-loan items.

4. `controllers/` and `routes/` — added the required endpoints for search, bulk returns, loan history, alerts, dashboard, CSV import, and CSV export. Existing authentication and role middleware is reused.

5. Client API modules — extended the existing loan and item APIs and added the dashboard API.

6. Client features — added server-side loan search/filtering/pagination, bulk return controls, loan history, dashboard, overdue alerts, and catalogue import/export interfaces.


---
**## M07 — Admin Management**

**### Scope**

Add the `ADMIN` role and provide Admin-only management of user roles and item custodians, while preserving all existing MEMBER and LIBRARIAN functionality.

**### What was build**

1. `models/User.js` — add `ADMIN` as a valid role.

2. `services/adminService.js` — implement Admin business logic for user role changes and `ItemCustodian` synchronization. When a `LIBRARIAN` is changed to `MEMBER`, remove only their `ItemCustodian` records and preserve all catalogue items.

3. `controllers/adminController.js` and `routes/admin.js` — expose Admin-only endpoints through a dedicated `/api/admin` router.

4. `client/src/api/adminApi.js` — API functions for Admin user and custodian management.

5. `client/src/features/AdminUsersPage.jsx` — allow Admin to change users between `MEMBER` and `LIBRARIAN`.

6. `client/src/features/AdminCustodiansPage.jsx` — allow Admin to select an item and manage its librarian custodians using searchable checkboxes with Save/Cancel.

7. `client/src/app/App.jsx` — add Admin navigation for Users and Custodians.

8. Extend Admin read-only access to existing Catalogue, Loans, Dashboard, and Alerts views. Admin can see and search the same information as a librarian, including archived catalogue items, but cannot perform librarian actions.

**### Important rules**

* Only one `ADMIN` role is supported.
* Admin cannot create or modify another Admin.
* Changing `LIBRARIAN → MEMBER` removes that user's `ItemCustodian` assignments but never deletes catalogue items.
* Custodian management modifies only the `ItemCustodian` collection.
* Admin remains read-only for Catalogue, Loans, Dashboard, and Alerts.

**### Verification**

Add Admin tests covering role management, custodian synchronization, authorization, librarian downgrade cleanup, and read-only access.

Run the complete backend test suite and client build. Verify existing M01–M06 functionality remains unaffected.


*Later modules will be recorded here as they are completed.*