'use strict';

const adminService = require('../services/adminService');

async function getUsers(req, res, next) {
  try {
    const users = await adminService.getUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const result = await adminService.updateUserRole(req.params.id, role, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCustodians(req, res, next) {
  try {
    const librarians = await adminService.getCustodians(req.params.id);
    res.json({ librarians });
  } catch (err) {
    next(err);
  }
}

async function setCustodians(req, res, next) {
  try {
    const { librarianIds } = req.body;
    if (!Array.isArray(librarianIds)) {
      return res.status(400).json({ error: { message: 'librarianIds must be an array' } });
    }
    await adminService.setCustodians(req.params.id, librarianIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsers,
  updateUserRole,
  getCustodians,
  setCustodians,
};
