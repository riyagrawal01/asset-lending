'use strict';

/**
 * itemService — catalogue business logic.
 *
 * Responsibilities:
 *  - list items (active by default, optional include-archived flag)
 *  - get a single item by id
 *  - create a new item (LIBRARIAN only — enforced by middleware before this runs)
 *  - update an item's title, category, or code
 *  - archive an item (soft-delete)
 *  - restore an archived item
 *
 * Authorization is enforced upstream in the route middleware.
 * Validation that cannot be expressed by the Mongoose schema is done here.
 */

const { Item } = require('../models/Item');

// Helpers

/**
 * Build a safe, serialisable item object from a Mongoose document.
 * Always returned from public functions so callers never receive raw docs.
 */
function toDTO(doc) {
  return {
    id: doc._id,
    title: doc.title,
    category: doc.category,
    code: doc.code,
    archived: doc.archived,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function appError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

// Service functions

async function listItems({ includeArchived = false } = {}) {
  const filter = includeArchived ? {} : { archived: false };
  const items = await Item.find(filter).sort({ title: 1 });
  return items.map(toDTO);
}


async function getItemById(id) {
  const item = await Item.findById(id);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }
  return toDTO(item);
}

async function createItem({ title, category, code }) {
  if (!title || !String(title).trim()) {
    throw appError('Title is required.', 400, 'VALIDATION_ERROR');
  }
  if (!category || !String(category).trim()) {
    throw appError('Category is required.', 400, 'VALIDATION_ERROR');
  }
  if (!code || !String(code).trim()) {
    throw appError('Code is required.', 400, 'VALIDATION_ERROR');
  }

  // Check for duplicate code before hitting the unique index, so we can return a cleaner error than a MongoServerError.
  const existing = await Item.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    throw appError(
      `An item with code "${code.trim().toUpperCase()}" already exists.`,
      409,
      'DUPLICATE_CODE'
    );
  }

  const item = await Item.create({ title, category, code });
  return toDTO(item);
}


async function updateItem(id, { title, category, code }) {
  const item = await Item.findById(id);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }

  // If a new code is supplied and it's different from the current one,
  // check for conflicts.
  if (code !== undefined) {
    const normalised = code.trim().toUpperCase();
    if (normalised !== item.code) {
      const conflict = await Item.findOne({ code: normalised, _id: { $ne: id } });
      if (conflict) {
        throw appError(
          `An item with code "${normalised}" already exists.`,
          409,
          'DUPLICATE_CODE'
        );
      }
      item.code = normalised;
    }
  }

  if (title !== undefined) item.title = title.trim();
  if (category !== undefined) item.category = category.trim();

  await item.save();
  return toDTO(item);
}


async function archiveItem(id) {
  const item = await Item.findById(id);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }
  if (item.archived) {
    throw appError('Item is already archived.', 409, 'ALREADY_ARCHIVED');
  }
  item.archived = true;
  await item.save();
  return toDTO(item);
}


async function restoreItem(id) {
  const item = await Item.findById(id);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }
  if (!item.archived) {
    throw appError('Item is not archived.', 409, 'NOT_ARCHIVED');
  }
  item.archived = false;
  await item.save();
  return toDTO(item);
}

module.exports = {
  listItems,
  getItemById,
  createItem,
  updateItem,
  archiveItem,
  restoreItem,
};
