const mongoose = require("mongoose");

const studentProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

<<<<<<< HEAD
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },

=======
>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
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

<<<<<<< HEAD
    submissionLink: {
      type: String,
      trim: true,
      default: "",
=======
    // --- CP Fields ---
    submissionLink: {
      type: String,
      default: "",
      trim: true, // LeetCode / Codeforces / GitHub submission URL
>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
    },

    attempts: {
      type: Number,
      default: 0,
<<<<<<< HEAD
      min: 0,
=======
      min: 0, // Number of trials/submissions
>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
    },

    timeSpent: {
      type: Number,
      default: 0,
<<<<<<< HEAD
      min: 0,
    },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "need_help", "done"],
      default: "not_started",
    },

=======
      min: 0, // Time spent in minutes
    },

    // --- Dev Fields ---
>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
    watched: {
      type: Boolean,
      default: false,
    },

<<<<<<< HEAD
=======
    // --- Status ---
    status: {
      type: String,
      enum: ["not_started", "in_progress", "done"],
      default: "not_started",
    },

>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
<<<<<<< HEAD
  },
);

studentProgressSchema.index(
  { student: 1, batch: 1, content: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.StudentProgress ||
  mongoose.model("StudentProgress", studentProgressSchema);
=======
  }
);

// Prevent duplicate progress entries for the same student and content
studentProgressSchema.index({ student: 1, content: 1 }, { unique: true });

module.exports =
  mongoose.models.StudentProgress ||
  mongoose.model("StudentProgress", studentProgressSchema);
>>>>>>> 7a5c0cdc8fed77aac4cade5f4b7d6377e720e622
