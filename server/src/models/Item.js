'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const itemSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },

    code: {
      type: String,
      required: [true, 'Code is required'],
      trim: true,
      uppercase: true,
    },

    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

itemSchema.index({ code: 1 }, { unique: true });

const Item = mongoose.model('Item', itemSchema);

module.exports = { Item };
