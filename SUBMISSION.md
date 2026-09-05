# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** https://github.com/riyagrawal01/asset-lending
- **Live application:**  https://asset-lending-snowy.vercel.app/

## Notes for the reviewer

The application is deployed with the React frontend on Vercel and the Node/Express backend on Render, with MongoDB Atlas as the database.

The backend may take a short time to respond if the Render service has been idle. If the first request is slow, please wait a few seconds and refresh/retry.

The application supports three roles:
- MEMBER
- LIBRARIAN
- ADMIN

ADMIN has management privileges for user roles and item custodians, while catalogue, loans, alerts and dashboard data are available to ADMIN in read-only form where applicable.

## Demo credentials

| Role      | Email              | Password    |
|-----------|--------------------|-------------|
| ADMIN     | admin@gmail.com    |     12345678|
| LIBRARIAN | librarian@gmail.com| Password@123|
| MEMBER    | member@gmail.com   | Password@123|

## Stack

| Layer    | What you used            | Why |
|----------|--------------------------|-----|
| Frontend | React + Vite             | Simple component-based UI with a fast development and build process |
| Backend  | Node.js + Express        | Lightweight REST API and easy separation of routes, controllers and services |
| Database | MongoDB Atlas + Mongoose | Flexible data model with validation, indexing and easy MongoDB integration |
| Hosting  | Vercel + Render          | Vercel for the frontend and Render for the backend, keeping deployments simple and separate |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal             | Status | Notes |
|---|------------------|--------|-------|
| 1 | Accounts & roles | Done   | Authentication with MEMBER, LIBRARIAN and ADMIN roles, with server-side authorization |
| 2 | Catalogue        | Done   | Item creation, editing, archiving/restoring, archived catalogue view, CSV import and on-loan CSV expor|
| 3 | Loans            | Done   | Members can request loans; librarians can issue and return loans; loan history is available |
| 4 | Loan lifecycle & rules | Done | REQUESTED → ISSUED → RETURNED and ISSUED → LOST transitions are enforced server-side |
| 5 | Custodians       | Done   | Multiple librarians can be custodians of an item; ADMIN can assign/remove custodians and manage librarian roles |
| 6 | Finding loans    | Done   | Server-side search, filtering, sorting, pagination and total-match counts |
| 7 | Bulk operations  | Done   | CSV import with row-level validation, bulk loan return with independent per-loan processing and results,and  CSV export of currently-on-loan items |
| 8 | Dashboard        | Done   | Librarian dashboard with aggregations, member personal dashboard, and ADMIN dashboard with user/librarian counts |
| 9 | Immutable history| Done   | LoanEvent records preserve the loan lifecycle with timestamps, actors and notes |
|10 | Overdue alerts   | Done   | Overdue alerts with dismissal and librarian notification indicators for unseen requests/alerts |


## How much time did you actually spend?

Approximately **14 hours**. This included implementing the core functionality, testing the different user roles and edge cases, refining the UI, fixing issues found during integration, preparing the application for production, and deploying both the frontend and backend.

## What would you do next, with another 12 hours?

With another 12 hours, I would focus on improving performance and adding a few useful features, such as:

- Add email/in-app notifications for loan requests, approvals and overdue items.
- Add better dashboard analytics and more useful insights.
- Improve search and database performance with additional indexing and query optimization.
- Improve loading, error and empty states across the application.
- Improve accessibility and responsive behavior across the UI.
- Add caching where appropriate for frequently requested dashboard and catalogue data.

## What are you least happy with in this codebase, and why?

The main area I would improve is the amount of role-specific logic in the frontend. As ADMIN functionality was added on top of the existing MEMBER/LIBRARIAN flows, some components now contain several role-based conditions for determining which actions are visible. The backend authorization is kept strict, but the frontend could be refactored further to make these permissions and read-only states more centralized and easier to maintain.