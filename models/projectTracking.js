const mongoose = require("mongoose");

const trackedStudentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Completed"],
      default: "Completed",
      required: true,
    },

    trackedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const projectTrackingSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },

    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    students: {
      type: [trackedStudentSchema],
      required: true,
      default: [],
    },

    startedAt: {
      type: Date,
      required: true,
    },

    completedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["Completed"],
      default: "Completed",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

projectTrackingSchema.index(
  {
    assignment: 1,
    mentor: 1,
  },
  {
    unique: true,
  },
);

module.exports =
  mongoose.models.ProjectTracking ||
  mongoose.model("ProjectTracking", projectTrackingSchema);
