const mongoose = require('mongoose');
const { User, ROLES } = require('./server/src/models/User');
const { Loan } = require('./server/src/models/Loan');
const { Item } = require('./server/src/models/Item');
const loanService = require('./server/src/services/loanService');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/asset_lending_dev');
  const admin = await User.findOne({ role: 'ADMIN' });
  if (!admin) {
    console.log('No admin found');
  } else {
    console.log('Admin found:', admin.email);
    
    // simulate getLoans
    const result = await loanService.searchLoans({});
    console.log('Total loans in DB:', await Loan.countDocuments());
    console.log('searchLoans result count:', result.data.length);
  }
  process.exit(0);
}
run();
