# Schema

## Collections

### users

| Field          | Type     | Notes                        |
| -------------- | -------- | ---------------------------- |
| `_id`          | ObjectId | MongoDB primary key          |
| `name`         | String   | required, trimmed            |
| `email`        | String   | required, unique, lowercased |
| `passwordHash` | String   | required, `select: false`    |
| `role`         | String   | enum: `LIBRARIAN`, `MEMBER`  |
| `createdAt`    | Date     | set by Mongoose timestamps   |
| `updatedAt`    | Date     | set by Mongoose timestamps   |

**Constraints:**

* `email` has a unique database index.
* `passwordHash` is stored as a hash rather than plaintext. Password hashing is handled by the authentication service.
* `select: false` keeps `passwordHash` out of normal query results. Authentication code can explicitly request it with `.select('+passwordHash')`.

---

### items

| Field       | Type     | Notes                        |
| ----------- | -------- | ---------------------------- |
| `_id`       | ObjectId | MongoDB primary key          |
| `title`     | String   | required, trimmed            |
| `category`  | String   | required, trimmed            |
| `code`      | String   | required, unique, uppercased |
| `archived`  | Boolean  | default: `false`             |
| `createdAt` | Date     | set by Mongoose timestamps   |
| `updatedAt` | Date     | set by Mongoose timestamps   |

**Constraints:**

* `code` has a unique database index.
* Items are archived by setting `archived` to `true`; the document is not deleted.
* Loan history remains available after an item is archived.
* Item availability is determined from its open loans rather than stored on the item itself.

---

### loans

| Field            | Type             | Notes                                           |
| ---------------- | ---------------- | ----------------------------------------------- |
| `_id`            | ObjectId         | MongoDB primary key                             |
| `item`           | ObjectId → items | required                                        |
| `borrower`       | ObjectId → users | required                                        |
| `createdBy`      | ObjectId → users | required; user who created the loan record      |
| `status`         | String           | enum: `REQUESTED`, `ISSUED`, `RETURNED`, `LOST` |
| `requestedAt`    | Date             | required                                        |
| `dueDate`        | Date             | nullable until the loan is issued               |
| `alertDismissed` | Boolean          | default: `false`                                |
| `createdAt`      | Date             | set by Mongoose timestamps                      |
| `updatedAt`      | Date             | set by Mongoose timestamps                      |

**Constraints:**

* `OVERDUE` is not stored as a status. It is derived when `status === ISSUED` and `dueDate` is in the past.
* `dueDate` is not set for a newly requested loan and is populated when the loan is issued.
* `alertDismissed` belongs to an individual loan, so a new loan for the same item starts with its own dismissal state.
* An item can have at most one open loan (`REQUESTED` or `ISSUED`), enforced by a partial unique index on `item`.

**Valid transitions:**

```text
REQUESTED → ISSUED

ISSUED → RETURNED

ISSUED → LOST
```

The transition definitions are present in the model and enforced by the loan service.

---

### loanevents

| Field       | Type             | Notes                                           |
| ----------- | ---------------- | ----------------------------------------------- |
| `_id`       | ObjectId         | MongoDB primary key                             |
| `loan`      | ObjectId → loans | required                                        |
| `type`      | String           | enum: `REQUESTED`, `ISSUED`, `RETURNED`, `LOST` |
| `actor`     | ObjectId → users | required                                        |
| `timestamp` | Date             | required; defaults to creation time             |
| `note`      | String           | optional; defaults to `null`                    |
| `createdAt` | Date             | set by Mongoose timestamps                      |
| `updatedAt` | —                | not enabled for this model                      |

**Constraints:**

* Loan events are intended to be append-only.
* `updatedAt` is disabled because an event represents a historical action rather than an editable record.
* There is no normal API path for editing or deleting loan events.

---

### itemcustodians

| Field       | Type             | Notes                      |
| ----------- | ---------------- | -------------------------- |
| `_id`       | ObjectId         | MongoDB primary key        |
| `item`      | ObjectId → items | required                   |
| `librarian` | ObjectId → users | required                   |
| `createdAt` | Date             | set by Mongoose timestamps |
| `updatedAt` | Date             | set by Mongoose timestamps |

**Constraints:**

* The `(item, librarian)` pair has a unique compound index.
* A librarian can be assigned to many items.
* An item can have multiple librarians.
* The librarian's role is checked by the service layer when custodians are assigned.

---

## Relationships summary

| Relationship            | Type         | How modeled                          |
| ----------------------- | ------------ | ------------------------------------ |
| User → Loan (borrower)  | one-to-many  | `loans.borrower` ObjectId reference  |
| User → Loan (createdBy) | one-to-many  | `loans.createdBy` ObjectId reference |
| Item → Loan             | one-to-many  | `loans.item` ObjectId reference      |
| Loan → LoanEvent        | one-to-many  | `loanevents.loan` ObjectId reference |
| User ↔ Item (custodian) | many-to-many | `itemcustodians` collection          |

---

## Database constraints vs application constraints

| Rule                                    | Where enforced                     | Why                                                            |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `email` unique                          | Database unique index              | Prevents duplicate values at the database level                |
| `code` unique                           | Database unique index              | Prevents duplicate catalogue codes                             |
| `(item, librarian)` unique              | Database unique index              | Prevents duplicate custodian assignments                       |
| One open loan per item                  | Database partial unique index      | Prevents multiple `REQUESTED`/`ISSUED` loans for the same item |
| Required fields                         | Mongoose schema                    | Basic document validation                                      |
| Enum values                             | Mongoose schema                    | Prevents invalid status, role, and event values                |
| Loan lifecycle transitions              | Service layer                      | Requires checking the current loan state                       |
| Item availability                       | Service layer / database operation | Depends on the item's current open loans                       |
| Librarian role for custodian assignment | Service layer                      | Requires checking the referenced user's role                   |
| Loan event immutability                 | Application layer                  | Updates and deletes must be rejected                           |
| Overdue status                          | Application/query logic            | It depends on the current time and is therefore derived        |

The database handles constraints that can be expressed directly on a document or index. Rules involving the current state of other documents or a sequence of actions remain in the service layer.

---

## Deliberate denormalization

None at M02.

The core entities are kept in separate collections and related using ObjectId references. Item titles and borrower names are not copied into the Loan document.

The loan search will need information from the related Item and User documents when it is implemented. The query approach can be chosen at that point based on the required filters and actual performance.

If the search becomes a bottleneck at larger data volumes, denormalizing frequently searched values can be considered later.

---

## Indexes

| Model         | Index                              | Reason                                                                |
| ------------- | ---------------------------------- | --------------------------------------------------------------------- |
| User          | `{ email: 1 }` unique              | Login lookup by email and uniqueness                                  |
| Item          | `{ code: 1 }` unique               | Lookup by catalogue code and uniqueness                               |
| Loan          | `{ item: 1 }` unique, partial      | Prevent more than one open loan (`REQUESTED` or `ISSUED`) for an item |
| Loan          | `{ borrower: 1, status: 1 }`       | Retrieve and filter a member's loans                                  |
| Loan          | `{ status: 1, dueDate: 1 }`        | Find issued loans by due date for overdue-related queries             |
| Loan          | `{ item: 1, requestedAt: -1 }`     | Retrieve an item's loan history in request order                      |
| LoanEvent     | `{ loan: 1, timestamp: 1 }`        | Retrieve a loan's events in chronological order                       |
| ItemCustodian | `{ item: 1, librarian: 1 }` unique | Prevent duplicate assignments and support pair lookups                |
| ItemCustodian | `{ librarian: 1 }`                 | Find all items assigned to a librarian                                |

The Loan partial unique index applies only when the loan status is `REQUESTED` or `ISSUED`. Returned and lost loans can therefore remain as history for the same item.

The indexes are based on the access patterns already defined by the requirements. No separate category index is added at this stage because category filtering is not currently a required query.

The standalone `{ item: 1 }` ItemCustodian index is not needed because `item` is the first field in the existing compound index.

---

## What would break first at 100× data

1. **Loan search** — searching by item title and borrower name will require accessing related documents. This is likely to become one of the first areas to investigate as the dataset grows.

2. **Dashboard aggregations** — status counts and weekly return statistics will require aggregation over the loan data. At larger volumes, these queries may need to be measured and optimized or moved toward pre-computed summaries.

3. **CSV imports** — larger imports will increase validation and write costs. Batch operations can help, and a streaming approach could be considered if import sizes become significantly larger.

4. **Overdue queries** — the current `{ status: 1, dueDate: 1 }` index supports the expected overdue queries. If measurements later show that the query is becoming expensive, the index can be revisited based on the actual data distribution.
