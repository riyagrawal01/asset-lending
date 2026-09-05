'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  LIBRARIAN: 'LIBRARIAN',
  MEMBER: 'MEMBER',
});

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, 
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'Role is required'],
    },

    // Notification "seen" timestamps for LIBRARIAN users.
    // A request/alert is considered "new" if it was created/became active
    // after this timestamp. Null means "never seen" (treat as epoch 0).
    notifRequestsSeenAt: {
      type: Date,
      default: null,
    },
    notifAlertsSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

module.exports = { User, ROLES };
