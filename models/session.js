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
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    week: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    type: {
      type: String,
      enum: ["Lecture", "Experience Sharing", "Contest"],
      required: true,
    },

    // e.g. "Lecture 1", "Lecture 2", "Lecture 3", "Contest",
    // "Experience Sharing". Auto-generated for Lectures unless
    // explicitly provided.
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Position within its type for the week (Lecture 1 = 1,
    // Lecture 2 = 2, ...). Contest/Experience Sharing default to 1
    // since there is normally only one of each per week.
    order: {
      type: Number,
      required: true,
      default: 1,
    },

    date: {
      type: Date,
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// One session name per batch/week (prevents duplicate "Lecture 2"
// entries for the same batch in the same week).
sessionSchema.index(
  { batch: 1, week: 1, name: 1 },
  { unique: true, name: "batch_week_name_unique" },
);

module.exports =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
