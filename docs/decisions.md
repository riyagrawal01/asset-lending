# Decisions

Important design decisions made during M02.

---

## Decision 1 — Derive overdue status

**Chose:** Derive overdue from `status === ISSUED` and `dueDate < now`.

**Rejected:** Storing `OVERDUE` as a loan status.

**Why:** Avoids a background job and keeps overdue status from becoming stale.

---

## Decision 2 — Separate loan history

**Chose:** Use a separate `LoanEvent` collection.

**Rejected:** Embedding events inside `Loan`.

**Why:** Keeps loan documents smaller and gives the history its own structure and index.

---

## Decision 3 — Custodian join collection

**Chose:** Use `ItemCustodian` for the user–item relationship.

**Rejected:** Storing librarian IDs directly on `Item`.

**Why:** The application needs both item → custodians and librarian → items lookups.

---

## Decision 4 — Availability enforced through open loans

**Chose**: Determine availability from open loans and enforce one open loan per item with a partial unique index.

**Rejected**: Storing an available flag on Item.

**Why**: Avoids having two sources of truth and prevents concurrent requests from creating multiple open loans for the same item.

---

## DEcision 5- Server-side search and aggregation

**Chose**: Perform loan filtering, sorting, pagination, and dashboard calculations in MongoDB.

**Rejected**: Loading the complete dataset into React or Node and processing it there.

**Why**: Reduces data transfer and keeps database operations efficient as the dataset grows.

---

## Decision 6- Librarian downgrade cleanup

**Chose**: When a LIBRARIAN becomes a MEMBER, remove their ItemCustodian assignments but preserve all catalogue items.

**Rejected**: Deleting items or retaining invalid custodian assignments.

**Why**: The user's role changes, but catalogue data and item history must remain intact.