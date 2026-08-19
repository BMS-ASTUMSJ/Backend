const mongoose = require("mongoose");

const studentProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProgressContent",
      required: true,
    },

    type: {
      type: String,
      enum: ["cp", "dev"],
      required: true,
    },

    // --- CP Fields ---
    submissionLink: {
      type: String,
      default: "",
      trim: true, // LeetCode / Codeforces / GitHub submission URL
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0, // Number of trials/submissions
    },

    timeSpent: {
      type: Number,
      default: 0,
      min: 0, // Time spent in minutes
    },

    // --- Dev Fields ---
    watched: {
      type: Boolean,
      default: false,
    },

    // --- Status ---
    status: {
      type: String,
      enum: ["not_started", "in_progress", "done"],
      default: "not_started",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate progress entries for the same student and content
studentProgressSchema.index({ student: 1, content: 1 }, { unique: true });

module.exports =
  mongoose.models.StudentProgress ||
  mongoose.model("StudentProgress", studentProgressSchema);