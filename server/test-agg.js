const mongoose = require('mongoose');
const { Item } = require('./server/src/models/Item');
const { Loan } = require('./server/src/models/Loan');

mongoose.connect('mongodb://127.0.0.1:27017/asset-lending-dev')
  .then(async () => {
    const result = await Item.aggregate([
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
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  });
