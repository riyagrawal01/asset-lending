'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const itemCustodianSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item is required'],
    },
    
    librarian: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Librarian is required'],
    },
  },
  {
    timestamps: true,
  }
);


itemCustodianSchema.index({ item: 1, librarian: 1 }, { unique: true });

itemCustodianSchema.index({ librarian: 1 });

const ItemCustodian = mongoose.model('ItemCustodian', itemCustodianSchema);

module.exports = { ItemCustodian };
