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
