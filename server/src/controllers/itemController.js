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

// POST /api/items/import — CSV catalogue import (librarian only).
// Expects body as plain text CSV with header row: title,category,code
async function importCSV(req, res, next) {
  try {
    const text = typeof req.body === 'string' ? req.body : '';
    if (!text.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'CSV body is empty.' },
      });
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'CSV must have a header row and at least one data row.' },
      });
    }

    // Parse header to support any column order.
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const titleIdx    = header.indexOf('title');
    const categoryIdx = header.indexOf('category');
    const codeIdx     = header.indexOf('code');

    if (titleIdx === -1 || categoryIdx === -1 || codeIdx === -1) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'CSV header must contain columns: title, category, code.',
        },
      });
    }

    // Parse data rows — basic quoted-field support.
    const rows = lines.slice(1).map((line) => {
      const cols = parseCSVLine(line);
      return {
        title:    (cols[titleIdx]    ?? '').trim(),
        category: (cols[categoryIdx] ?? '').trim(),
        code:     (cols[codeIdx]     ?? '').trim(),
      };
    });

    const result = await itemService.importCSV(rows);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// Simple single-line CSV parser that handles double-quoted fields.
function parseCSVLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

// GET /api/items/export/on-loan — CSV export of ISSUED loans (librarian only).
async function exportOnLoan(req, res, next) {
  try {
    const csv = await itemService.exportOnLoan();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="on-loan.csv"');
    res.send(csv);
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
  importCSV,
  exportOnLoan,
};
