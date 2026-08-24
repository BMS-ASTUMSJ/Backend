const mongoose = require("mongoose");

// ============================================================
// TRACKED STUDENT
// ============================================================

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

// ============================================================
// PROJECT TRACKING
// ============================================================

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

    // --------------------------------------------------------
    // IMPORTANT:
    //
    // We ONLY save Completed students.
    //
    // Pending and In Progress exist ONLY in frontend state.
    // --------------------------------------------------------

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

// ============================================================
// ONE FINAL TRACKING RECORD PER MENTOR + ASSIGNMENT
// ============================================================

projectTrackingSchema.index(
  {
    assignment: 1,
    mentor: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("ProjectTracking", projectTrackingSchema);
