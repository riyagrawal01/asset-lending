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

## Decision 4 — Availability comes from loans

**Chose:** Determine whether an item is available from its open loans.

**Rejected:** Storing an `available` flag on `Item`.

**Why:** An availability flag would create a second source of truth. The atomic issue operation will be decided when the loan service is implemented.