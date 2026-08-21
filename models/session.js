const mongoose = require("mongoose");

// ============================================================
// SESSION MODEL
// ============================================================
//
// A "Session" is a single trackable event within a bootcamp
// week — e.g. "Lecture 1", "Lecture 2", "Lecture 3", "Contest",
// "Experience Sharing".
//
// The NUMBER of lectures per week is NOT fixed. Some weeks may
// have 2 lectures, others 4 (or any number). Admins configure
// this per batch/week. Mentors never create sessions — they
// only mark attendance against sessions that already exist.
// ============================================================

const sessionSchema = new mongoose.Schema(
  {
    // ========================================================
    // BATCH
    // ========================================================

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    // ========================================================
    // WEEK
    // ========================================================

    week: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    // ========================================================
    // SESSION TYPE
    // ========================================================

    type: {
      type: String,
      enum: ["Lecture", "Experience Sharing", "Contest"],
      required: true,
      trim: true,
    },

    // ========================================================
    // SESSION NAME
    // ========================================================

    // e.g. "Lecture 1", "Lecture 2", "Lecture 3", "Contest",
    // "Experience Sharing".
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ========================================================
    // POSITION WITHIN SESSION TYPE
    // ========================================================

    // Lecture 1 = 1
    // Lecture 2 = 2
    // Lecture 3 = 3
    //
    // Contest / Experience Sharing normally use 1.
    order: {
      type: Number,
      required: true,
      default: 1,
    },

    // ========================================================
    // SESSION DATE
    // ========================================================

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // ========================================================
    // CREATED BY
    // ========================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ========================================================
    // ACTIVE STATUS
    // ========================================================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// PREVENT DUPLICATE SESSIONS
// ============================================================
//
// One session name per batch/week.
// This prevents duplicate "Lecture 2" entries for the same
// batch and week.
//
// Different weeks can still have the same session name.
// ============================================================

sessionSchema.index(
  { batch: 1, week: 1, name: 1 },
  {
    unique: true,
    name: "batch_week_name_unique",
  },
);

module.exports =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
