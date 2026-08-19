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

    submissionLink: {
      type: String,
      default: "",
      trim: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    timeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    watched: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["not_started", "in_progress", "need_help", "done"],
      default: "not_started",
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

studentProgressSchema.index(
  { student: 1, batch: 1, content: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.StudentProgress ||
  mongoose.model("StudentProgress", studentProgressSchema);
