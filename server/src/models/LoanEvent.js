'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const EVENT_TYPES = Object.freeze({
  REQUESTED: 'REQUESTED',
  ISSUED:    'ISSUED',
  RETURNED:  'RETURNED',
  LOST:      'LOST',
});

const loanEventSchema = new Schema(
  {
    loan: {
      type: Schema.Types.ObjectId,
      ref: 'Loan',
      required: [true, 'Loan is required'],
    },
   
    type: {
      type: String,
      enum: Object.values(EVENT_TYPES),
      required: [true, 'Event type is required'],
    },
    
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor is required'],
    },
   
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: () => new Date(),
    },
    
    note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

loanEventSchema.index({ loan: 1, timestamp: 1 });

const LoanEvent = mongoose.model('LoanEvent', loanEventSchema);

module.exports = { LoanEvent, EVENT_TYPES };
