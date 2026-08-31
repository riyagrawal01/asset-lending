'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const LOAN_STATUSES = Object.freeze({
  REQUESTED: 'REQUESTED',
  ISSUED:    'ISSUED',
  RETURNED:  'RETURNED',
  LOST:      'LOST',
});


const VALID_TRANSITIONS = Object.freeze({
  REQUESTED: ['ISSUED'],
  ISSUED:    ['RETURNED', 'LOST'],
  RETURNED:  [],
  LOST:      [],
});

const loanSchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: [true, 'Item is required'],
    },
    
    borrower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Borrower is required'],
    },
    
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy is required'],
    },
    status: {
      type: String,
      enum: Object.values(LOAN_STATUSES),
      required: [true, 'Status is required'],
      default: LOAN_STATUSES.REQUESTED,
    },
    
    requestedAt: {
      type: Date,
      required: [true, 'RequestedAt is required'],
    },
    
    dueDate: {
      type: Date,
      default: null,
    },
    alertDismissed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


loanSchema.index({ item: 1, status: 1 });

loanSchema.index({ borrower: 1, status: 1 });

loanSchema.index({ status: 1, dueDate: 1 });

loanSchema.index({ item: 1, requestedAt: -1 });

const Loan = mongoose.model('Loan', loanSchema);

module.exports = { Loan, LOAN_STATUSES, VALID_TRANSITIONS };
