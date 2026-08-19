const mongoose = require("mongoose");

const progressContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cp", "dev"],
      required: true,
    },

    week: {
      type: Number,
      required: true,
      min: 1,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    link: {
      type: String,
      required: true,
      trim: true, // LeetCode/Codeforces URL or YouTube/Drive Video URL
    },

    // NEW: Associated Cohort Batch (e.g. Batch 1, Batch 2)
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Fast compound index for queries
progressContentSchema.index({ batch: 1, type: 1, week: 1, isPublished: 1 });

module.exports =
  mongoose.models.ProgressContent ||
  mongoose.model("ProgressContent", progressContentSchema);