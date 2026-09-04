'use strict';

const mongoose = require('mongoose');
const { User, ROLES } = require('../models/User');
const { ItemCustodian } = require('../models/ItemCustodian');
const { Item } = require('../models/Item');

function appError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

async function executeWithFallback(executeOp) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await executeOp({ session });
    });
  } catch (err) {
    if (
      err.code === 20 ||
      (err.message && err.message.includes('Transaction numbers are only allowed'))
    ) {
      await executeOp({});
    } else {
      throw err;
    }
  } finally {
    session.endSession();
  }
}

async function getUsers() {
  const users = await User.find({}, { passwordHash: 0 }).sort({ name: 1 });
  return users.map(u => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));
}

async function updateUserRole(userId, newRole, adminId) {
  if (userId === adminId.toString()) {
    throw appError('Cannot modify your own role.', 400, 'ADMIN_CANNOT_MODIFY_SELF');
  }

  if (newRole === ROLES.ADMIN) {
    throw appError('Cannot assign ADMIN role via this feature.', 400, 'INVALID_ROLE_ASSIGNMENT');
  }

  if (![ROLES.MEMBER, ROLES.LIBRARIAN].includes(newRole)) {
    throw appError('Invalid role specified.', 400, 'INVALID_ROLE');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw appError('User not found.', 404, 'USER_NOT_FOUND');
  }

  if (user.role === ROLES.ADMIN) {
    throw appError('Cannot modify the role of an ADMIN user.', 400, 'CANNOT_MODIFY_ADMIN');
  }

  // If changing LIBRARIAN -> MEMBER, we must clean up custodianships
  let custodiansRemoved = 0;
  
  if (user.role === ROLES.LIBRARIAN && newRole === ROLES.MEMBER) {
    await executeWithFallback(async (opts) => {
      user.role = newRole;
      await user.save(opts);
      
      const delResult = await ItemCustodian.deleteMany({ librarian: user._id }, opts);
      custodiansRemoved = delResult.deletedCount || 0;
    });
  } else {
    user.role = newRole;
    await user.save();
  }

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    custodiansRemoved
  };
}

async function getCustodians(itemId) {
  const item = await Item.findById(itemId);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }

  // Fetch all librarians
  const librarians = await User.find({ role: ROLES.LIBRARIAN }, { name: 1, email: 1 }).sort({ name: 1 }).lean();
  
  // Fetch current custodians for this item
  const currentCustodians = await ItemCustodian.find({ item: itemId }).lean();
  const custodianIds = new Set(currentCustodians.map(c => c.librarian.toString()));

  return librarians.map(lib => ({
    id: lib._id,
    name: lib.name,
    email: lib.email,
    isCustodian: custodianIds.has(lib._id.toString()),
  }));
}

async function setCustodians(itemId, librarianIds) {
  const item = await Item.findById(itemId);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }

  // Ensure all submitted librarianIds exist and are actually librarians
  const validLibrarians = await User.find({ _id: { $in: librarianIds }, role: ROLES.LIBRARIAN });
  const validIds = validLibrarians.map(u => u._id.toString());

  // Existing assignments
  const existing = await ItemCustodian.find({ item: itemId });
  const existingIds = existing.map(c => c.librarian.toString());

  const toAdd = validIds.filter(id => !existingIds.includes(id));
  const toRemove = existingIds.filter(id => !validIds.includes(id));

  if (toAdd.length === 0 && toRemove.length === 0) {
    return; // No changes needed
  }

  await executeWithFallback(async (opts) => {
    if (toRemove.length > 0) {
      await ItemCustodian.deleteMany({ item: itemId, librarian: { $in: toRemove } }, opts);
    }
    if (toAdd.length > 0) {
      const docs = toAdd.map(libId => ({ item: itemId, librarian: libId }));
      await ItemCustodian.insertMany(docs, opts);
    }
  });
}

module.exports = {
  getUsers,
  updateUserRole,
  getCustodians,
  setCustodians,
};
