'use strict';

/**
 * dashboardService — server-side aggregation for the dashboard view.
 *
 * All calculations happen inside MongoDB so the client receives a small
 * summary response rather than the full loan dataset.
 */

const { Loan, LOAN_STATUSES } = require('../models/Loan');
const { Item } = require('../models/Item');
const { ItemCustodian } = require('../models/ItemCustodian');
const { User } = require('../models/User');

async function getDashboard() {
  const now = new Date();

  // Start of the current ISO week (Monday) so "this week" is consistent.
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // back to Monday

  // -------------------------------------------------------------------------
  // Summary stats — one $facet aggregation over the loans collection.
  // -------------------------------------------------------------------------
  const [summaryResult] = await Loan.aggregate([
    {
      $facet: {
        currentlyOut: [
          { $match: { status: LOAN_STATUSES.ISSUED } },
          { $count: 'n' },
        ],
        overdue: [
          {
            $match: {
              status: LOAN_STATUSES.ISSUED,
              dueDate: { $lt: now },
            },
          },
          { $count: 'n' },
        ],
        returnedThisWeek: [
          {
            $match: {
              status: LOAN_STATUSES.RETURNED,
              updatedAt: { $gte: startOfThisWeek },
            },
          },
          { $count: 'n' },
        ],
        loansByStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          { $project: { _id: 0, status: '$_id', count: 1 } },
          { $sort: { status: 1 } },
        ],
      },
    },
  ]);

  const summary = {
    currentlyOut: summaryResult.currentlyOut[0]?.n ?? 0,
    overdue: summaryResult.overdue[0]?.n ?? 0,
    returnedThisWeek: summaryResult.returnedThisWeek[0]?.n ?? 0,
    loansByStatus: summaryResult.loansByStatus,
  };

  // -------------------------------------------------------------------------
  // Total active catalogue items (non-archived).
  // -------------------------------------------------------------------------
  const totalItems = await Item.countDocuments({ archived: false });

  // -------------------------------------------------------------------------
  // Items returned per week for the previous 8 weeks (including current week).
  //
  // We bucket each returned loan by the Monday of its return week, then group.
  // -------------------------------------------------------------------------
  const eightWeeksAgo = new Date(startOfThisWeek);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 7 * 7); // 7 full past weeks + current

  const weeklyReturns = await Loan.aggregate([
    {
      $match: {
        status: LOAN_STATUSES.RETURNED,
        updatedAt: { $gte: eightWeeksAgo },
      },
    },
    {
      // Compute the Monday of the week for each loan's updatedAt.
      $addFields: {
        weekStart: {
          $dateSubtract: {
            startDate: {
              $dateTrunc: { date: '$updatedAt', unit: 'day' },
            },
            unit: 'day',
            // day-of-week: 1=Sun…7=Sat in MongoDB; convert to Mon-based offset
            amount: {
              $mod: [
                { $subtract: [{ $dayOfWeek: '$updatedAt' }, 2] },
                7,
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: '$weekStart',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        weekStart: '$_id',
        count: 1,
      },
    },
  ]);

  // -------------------------------------------------------------------------
  // Breakdown by librarian.
  //
  // Shows every librarian user alongside:
  //   - itemsManaged   — number of items they are a custodian for
  //   - activeLoans    — ISSUED loans for those items
  //   - overdueLoans   — ISSUED + past due for those items
  //
  // Starting from the users collection so that librarians with no custodian
  // assignments still appear (with zeros) rather than being omitted.
  // -------------------------------------------------------------------------
  const custodianRows = await require('../models/User').User.aggregate([
    { $match: { role: 'LIBRARIAN' } },

    // Find all items this librarian is a custodian for.
    {
      $lookup: {
        from: 'itemcustodians',
        localField: '_id',
        foreignField: 'librarian',
        as: 'custodianDocs',
      },
    },

    // Collect item IDs.
    {
      $addFields: {
        itemIds: '$custodianDocs.item',
      },
    },

    // Find active (ISSUED) loans for those items.
    {
      $lookup: {
        from: 'loans',
        let: { items: '$itemIds' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$item', '$$items'] },
              status: LOAN_STATUSES.ISSUED,
            },
          },
        ],
        as: 'activeLoans',
      },
    },

    {
      $project: {
        _id: 0,
        custodian: { id: '$_id', name: '$name', email: '$email' },
        itemsManaged: { $size: '$itemIds' },
        activeLoans: { $size: '$activeLoans' },
        overdueLoans: {
          $size: {
            $filter: {
              input: '$activeLoans',
              as: 'l',
              cond: { $lt: ['$$l.dueDate', now] },
            },
          },
        },
      },
    },
    { $sort: { 'custodian.name': 1 } },
  ]);

  // -------------------------------------------------------------------------
  // Catalogue Status Breakdown for Pie Chart
  // -------------------------------------------------------------------------
  const catalogueStatusResult = await Item.aggregate([
    {
      $facet: {
        archived: [
          { $match: { archived: true } },
          { $count: 'n' }
        ],
        notArchived: [
          { $match: { archived: false } },
          {
            $lookup: {
              from: 'loans',
              let: { itemId: '$_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$item', '$$itemId'] } } },
                { $sort: { createdAt: -1 } },
                { $limit: 1 }
              ],
              as: 'latestLoan'
            }
          },
          {
            $project: {
              status: {
                $cond: {
                  if: { $eq: [{ $size: '$latestLoan' }, 0] },
                  then: 'AVAILABLE',
                  else: { $arrayElemAt: ['$latestLoan.status', 0] }
                }
              }
            }
          },
          {
            $group: {
              _id: {
                $cond: {
                  if: { $eq: ['$status', 'RETURNED'] },
                  then: 'AVAILABLE',
                  else: '$status'
                }
              },
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  const rawArchived = catalogueStatusResult[0].archived[0]?.n || 0;
  const rawNotArchived = catalogueStatusResult[0].notArchived || [];

  // Normalize into exactly 5 categories: Available, Issued, Requested, Lost, Archived
  const catalogueStatus = {
    available: rawNotArchived.find(s => s._id === 'AVAILABLE')?.count || 0,
    issued: rawNotArchived.find(s => s._id === 'ISSUED')?.count || 0,
    requested: rawNotArchived.find(s => s._id === 'REQUESTED')?.count || 0,
    lost: rawNotArchived.find(s => s._id === 'LOST')?.count || 0,
    archived: rawArchived
  };

  return {
    summary: { ...summary, totalItems },
    weeklyReturns,
    byCustodian: custodianRows,
    catalogueStatus,
    // ADMIN-only: user counts from DB. The controller strips this for LIBRARIAN.
    userCounts: {
      members: await User.countDocuments({ role: 'MEMBER' }),
      librarians: await User.countDocuments({ role: 'LIBRARIAN' }),
    },
  };
}

// ---------------------------------------------------------------------------
// Member dashboard — personal borrowing stats for MEMBER users only.
// Returns only data scoped to the requesting user's own loans.
// ---------------------------------------------------------------------------

async function getMemberDashboard(userId) {
  const now = new Date();

  const [summaryResult] = await Loan.aggregate([
    { $match: { borrower: userId } },
    {
      $facet: {
        activeLoans: [
          { $match: { status: LOAN_STATUSES.ISSUED } },
          { $count: 'n' },
        ],
        requestedLoans: [
          { $match: { status: LOAN_STATUSES.REQUESTED } },
          { $count: 'n' },
        ],
        returnedLoans: [
          { $match: { status: LOAN_STATUSES.RETURNED } },
          { $count: 'n' },
        ],
        overdueLoans: [
          {
            $match: {
              status: LOAN_STATUSES.ISSUED,
              dueDate: { $lt: now },
            },
          },
          { $count: 'n' },
        ],
        totalLoans: [{ $count: 'n' }],
      },
    },
  ]);

  const counts = {
    active: summaryResult.activeLoans[0]?.n ?? 0,
    requested: summaryResult.requestedLoans[0]?.n ?? 0,
    returned: summaryResult.returnedLoans[0]?.n ?? 0,
    overdue: summaryResult.overdueLoans[0]?.n ?? 0,
    total: summaryResult.totalLoans[0]?.n ?? 0,
  };

  // Current active (ISSUED) loans with item details — so member can see what
  // they have out and when it is due.
  const currentLoans = await Loan.find({
    borrower: userId,
    status: { $in: [LOAN_STATUSES.ISSUED, LOAN_STATUSES.REQUESTED] },
  })
    .populate('item', 'title code category')
    .sort({ dueDate: 1 })
    .lean();

  const activeList = currentLoans.map((l) => ({
    id: l._id,
    item: l.item,
    status: l.status,
    requestedAt: l.requestedAt,
    dueDate: l.dueDate,
  }));

  return { counts, activeList };
}

module.exports = { getDashboard, getMemberDashboard };
