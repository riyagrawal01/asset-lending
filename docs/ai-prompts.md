# AI Prompts

This file records the significant AI-assisted development prompts used during the project, along with important corrections made after reviewing the generated work.

## M1 — Foundation

### What I was trying to achieve

Set up the initial client and server foundation so the rest of the project could be built on it.

### Prompt

Asked the AI agent to read requirements and the assignment, inspect the repository, and implement only the M1 foundation.

The requested scope included the client/server setup, configuration, MongoDB connection, health endpoint, basic middleware, Vite development proxy, API client, development scripts, and verification.

### What I got

The agent created the initial client and server structure and the required development setup within the M1 scope.

### What I corrected

I reviewed the generated implementation against the M1 scope before moving forward. I also installed the dependencies, ran the available checks, started the application, and verified the health endpoint.

No major correction was required to the implementation itself.

## M02 — Data model

### Prompt

Inspect the existing M01 implementation and documentation before making changes.

Implement M02: the MongoDB/Mongoose data model for the five entities:

* User
* Item
* Loan
* LoanEvent
* ItemCustodian

Use the schema, relationships, constraints, and indexes we have already agreed on. Do not redesign the model or add speculative fields, collections, or indexes.

Key requirements:

* Use references between related documents.
* Keep `OVERDUE` derived from `ISSUED` + past `dueDate`; do not persist it as a status.
* Keep loan history in a separate `LoanEvent` collection.
* Model the User–Item custodian relationship through `ItemCustodian`.
* Enforce unique email, unique item code, and unique `(itemId, userId)` custodian assignments.
* Add the agreed indexes based on the required access patterns.
* Keep business rules such as loan transitions, authorization, and atomic issuing for their later modules; do not implement them in M02.

Inspect the existing project structure and follow the conventions already established in M01. Keep the implementation straightforward and avoid unnecessary abstractions.


Run appropriate tests/verification for the models and indexes.

Do not commit anything to Git.

When finished, give me a concise summary of:

1. what you changed,
2. what you verified,


### What I got

The models, indexes, constants, model exports, tests, and M02 documentation were added.

### What I corrected

I reviewed the result against the contract and the queries the application will need.

A few changes were made during the review:

- Removed the `category` index because there was no confirmed query that needed it yet.
- Added the `Loan` index on `item` and `requestedAt` for item loan history.
- Removed the redundant `ItemCustodian` `item` index because the compound index already starts with `item`.
- Clarified that disabling `updatedAt` on `LoanEvent` does not by itself prevent updates or deletes.
- Removed comments from the models where the code was already self-explanatory.

The schema were checked again after these changes.

---

## M03 — Authentication

### Prompt

Implement authentication for the application using JWT and bcrypt.

Add member registration, login, authentication middleware, and role checking for librarians and members. Registration should always create a member account. Use a 3-day JWT and store the token in `localStorage` on the client. Registration should not automatically log the user in.

Keep the implementation simple and consistent with the existing project structure. Add tests for the main authentication and authorization cases.

### What I got

The implementation added the authentication service, routes, middleware, client token handling, and authentication tests.

### What I corrected

I reviewed the implementation and kept the authentication and role checking together in the existing middleware instead of introducing another middleware file. I also kept the token handling simple for now rather than adding refresh tokens or other authentication features that were not needed.

## M04 — Catalogue

### Prompt

Implement the catalogue part of the equipment lending application using the existing React, Express, and MongoDB setup.

Use the existing `Item` model and authentication/role middleware. Do not change the schema unless there is a real requirement that cannot be handled with the current model.

Librarians should be able to:

* create catalogue items
* edit items
* archive items
* restore archived items

Members should be able to view the catalogue but should not be able to modify it.

Archived items should not appear in the normal catalogue list, but they must remain in the database so that their history is preserved.

Add the required server routes, controllers, and service layer. Keep the controllers thin and put the catalogue logic in the service.

Handle duplicate item codes, invalid requests, missing items, and unauthorized access with appropriate responses.

For the client, add the catalogue API functions and the UI needed to view and manage items. Use the existing authentication flow and API client. The UI should show the appropriate actions based on the user's role, but authorization must still be enforced by the server.

Keep this module focused on catalogue functionality. Do not implement loans, custodians, bulk operations, dashboard features, or advanced loan searching yet.

Add tests for the main catalogue behaviour, including role restrictions, creating and editing items, archiving and restoring items, duplicate codes, and missing items.

Run the complete test suite after the changes and make sure the existing functionality still works.

### What I got

The catalogue service, controller, routes, client API, catalogue UI, and 26 catalogue tests were added.

### What I reviewed

I checked the generated implementation against the existing models and authentication flow. No schema changes were needed, and the catalogue functionality was kept separate from the loan-related features that will be implemented later.
I manually tested the APIs and functioning of the login and catlogue features.
Reviewed the code and checked for unneccessary or reduntant code pieces.

---
**## M05 — Loans**

**### Prompt**

Implement the loan functionality using the existing models, authentication, and catalogue features.

The loan lifecycle should be:

`REQUESTED → ISSUED → RETURNED/LOST`

Members should be able to request available items and view their own loans. Librarians should be able to view loans and perform the required issue, return, and lost actions.

Keep the existing `Loan` state machine and derive overdue status from `ISSUED` loans whose `dueDate` has passed. Do not add an `OVERDUE` status or an `available` field to `Item`.

An item must not have more than one open loan (`REQUESTED` or `ISSUED`). Enforce this at the database level using the appropriate partial unique index, and handle conflicts cleanly in the service layer.

Keep loan and `LoanEvent` changes consistent by using MongoDB transactions where required. Create a `LoanEvent` for each valid lifecycle action.

Add the required service, controller, routes, tests, and minimal client integration. Keep role checks on the server and follow the existing project structure.

Do not implement dashboard features, bulk operations, advanced loan searching, or overdue alerts yet.

Run the complete test suite and make sure all previous modules continue to work.

Do not commit anything to Git.

**### What I got**

The loan service, controller, routes, tests, client API, and loans UI were added. The catalogue was also updated so members can request items, and simple navigation between Catalogue and Loans was added.

A partial unique index was added to prevent multiple open loans for the same item. The loan lifecycle and role restrictions were implemented in the service and route layers.

**### What I reviewed**

I reviewed the implementation against the existing project structure and manually tested the functionality added so far, including authentication, catalogue operations, and the loan lifecycle. I also checked that the existing test suites continue to pass.


**### Result**

All existing tests and the new loan tests are passing.

---

## M06 — Search, Bulk Operations, Dashboard, Alerts

**### Prompt**

Implement M06 on top of the existing M01–M05 implementation.

Add the required search, filtering, sorting, and pagination for librarian loan views. All filtering and pagination must happen on the server/database; do not load the complete dataset into React.

Add bulk loan returns where each loan is processed independently and successful returns are not affected by failures in other loans. Reuse the existing loan lifecycle and event handling.

Add the required dashboard data using MongoDB aggregations. The dashboard must provide currently out, overdue, returned this week, total catalogue items, loans by status, custodian breakdown, and the previous eight weeks of returned-loan data. Do not calculate these statistics by loading the full loan history into the client.

Add overdue alerts based on the existing derived overdue rule. Alerts must belong to individual loan instances, and librarians must be able to dismiss them.

Add CSV catalogue import with row-level validation and partial success. Invalid rows should be reported without preventing valid rows from being imported. Add CSV export for all items currently out on loan.

Add the required API routes, controllers, services, client API modules, and UI components while following the existing project structure and authentication/role rules.

Keep the implementation focused on the M06 requirements. Do not introduce unnecessary dependencies, abstractions, caching, or unrelated features.

Add tests covering the new functionality, role restrictions, partial CSV import, bulk-return behaviour, dashboard aggregations, alerts, search/filtering, pagination, and CSV export.

Run the complete test suite and client build after implementation. Do not commit anything to Git.

**### What I got**

The M06 search, bulk-return, dashboard, alert, CSV import/export, API, UI, and test functionality was implemented.

**### What I reviewed**

I reviewed the implementation and manually tested the M06 features along with the existing application functionality.

During testing, I found an authentication issue with CSV upload where the request was using the wrong token. I corrected the client-side authentication handling so the upload uses the existing authenticated token correctly.

The complete test suite passed and the client build completed successfully.

--- 
**## M07 — Admin Management**

**### Prompt**

Implement the Admin functionality for the equipment lending application without disrupting the existing MEMBER and LIBRARIAN functionality.

Add `ADMIN` as a valid role. There will be only one Admin.

The Admin must have two management capabilities:

1. **User Role Management**

   * View registered users.
   * Change users between `MEMBER` and `LIBRARIAN`.
   * Do not allow creating or modifying an `ADMIN`.
   * When a `LIBRARIAN` is changed to `MEMBER`, remove that user's `ItemCustodian` records but do not delete any catalogue items.
   * Notify the Admin about the number of custodian assignments removed.

2. **Item Custodian Management**

   * Select an item.
   * Display librarians with searchable checkboxes.
   * Show the current custodian selections.
   * Allow the Admin to add/remove custodians and save or cancel changes.
   * Only modify the `ItemCustodian` collection.

Create a dedicated Admin route, service, controller, API module, and separate UI pages for these features.

Admin should also be able to view and search the same Catalogue, Loans, Dashboard, and Alerts information available to librarians, including archived catalogue items, but must not perform librarian actions such as creating/editing catalogue items, issuing/returning loans, or dismissing alerts.

Keep the existing architecture and avoid unnecessary schema or dependency changes.

Add tests covering Admin authorization, role changes, librarian downgrade cleanup, custodian synchronization, and Admin read-only access.

Run the full backend test suite and client build after implementation.

Do not commit anything.

**### What I got**

The Admin role, user role management, item custodian management, Admin pages, API, routes, and read-only access to the existing librarian views were implemented.

**### What I reviewed**

Reviewed and manually tested the Admin functionality and the existing M01–M06 features. Verified role changes, custodian assignment/removal, librarian downgrade cleanup, Admin read-only access, backend tests, and client build.

**### What I corrected**

The existing model test that treated `ADMIN` as an invalid role was updated to use `INVALID_ROLE` after adding the new valid role.

An issue in the Admin read-only integration was also corrected so Admins can access the librarian views without receiving librarian-only modification controls.
