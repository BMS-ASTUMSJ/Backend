const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    // ============================================================
    // BATCH
    // ============================================================

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    // ============================================================
    // WEEK
    // ============================================================

    week: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    // ============================================================
    // SESSION TYPE
    // ============================================================

    type: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // SESSION NAME
    // ============================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // SESSION DATE
    // ============================================================

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // ============================================================
    // ACTIVE STATUS
    // ============================================================

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

sessionSchema.index(
  {
    batch: 1,
    week: 1,
    name: 1,
  },
  {
    unique: true,
  },
);

module.exports =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
