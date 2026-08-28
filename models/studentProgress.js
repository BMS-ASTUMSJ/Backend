const mongoose = require("mongoose");

const studentProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
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

    topic: {
      type: String,
      default: "JavaScript",
      trim: true,
    },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "needs_help", "done"],
      default: "not_started",
    },

    submissionLink: {
      type: String,
      trim: true,
      default: "",
    },

    attempts: {
      type: Number,
      min: 0,
      default: 0,
    },

    timeSpent: {
      type: Number,
      min: 0,
      default: 0,
    },

    watched: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    mentorNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

studentProgressSchema.index(
  {
    student: 1,
    batch: 1,
    content: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("StudentProgress", studentProgressSchema);
