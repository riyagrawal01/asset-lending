'use strict';

//Item controller — thin. Delegates all logic to itemService.

const itemService = require('../services/itemService');

async function listItems(req, res, next) {
  try {
    const items = await itemService.listItems({ includeArchived: false });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function listArchivedItems(req, res, next) {
  try {
    const items = await itemService.listItems({ includeArchived: true });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function getItem(req, res, next) {
  try {
    const item = await itemService.getItemById(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const { title, category, code } = req.body;
    const item = await itemService.createItem({ title, category, code });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const { title, category, code } = req.body;
    const item = await itemService.updateItem(req.params.id, { title, category, code });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function archiveItem(req, res, next) {
  try {
    const item = await itemService.archiveItem(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

async function restoreItem(req, res, next) {
  try {
    const item = await itemService.restoreItem(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listItems,
  listArchivedItems,
  getItem,
  createItem,
  updateItem,
  archiveItem,
  restoreItem,
};
