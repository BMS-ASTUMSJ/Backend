const mongoose = require("mongoose");

const checkSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Excused", null],
      default: null,
    },

    markedAt: {
      type: Date,
      default: null,
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

const attendanceSchema = new mongoose.Schema(
  {
    // ============================================================
    // STUDENT
    // ============================================================

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ============================================================
    // MENTOR
    // ============================================================

    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ============================================================
    // TEAM
    // ============================================================

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
      index: true,
    },

    // ============================================================
    // BATCH
    // ============================================================

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
      index: true,
    },

    // ============================================================
    // MAIN COHORT SESSION
    // ============================================================

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
      index: true,
    },

    // ============================================================
    // WEEK
    // ============================================================

    week: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    // ============================================================
    // DAY
    // ============================================================

    dayName: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },

    // ============================================================
    // MEETING / SESSION TYPE
    // ============================================================

    meetingType: {
      type: String,
      enum: [
        "Daily Meeting",
        "Sunday Weekly Meeting",

        // Main Cohort
        "Lecture",
        "Experience Sharing",
        "Contest",
      ],
      required: true,
    },

    // ============================================================
    // SESSION TYPE
    // ============================================================

    sessionType: {
      type: String,
      enum: [
        "Daily Meeting",
        "Sunday Weekly Meeting",
        "Lecture",
        "Experience Sharing",
        "Contest",
      ],
      required: true,
    },

    // ============================================================
    // SESSION NAME
    // ============================================================

    sessionName: {
      type: String,
      default: "",
    },

    // ============================================================
    // DATE
    // ============================================================

    date: {
      type: Date,
      default: Date.now,
    },

    // ============================================================
    // FIRST CHECK
    // ============================================================

    firstCheck: {
      type: checkSchema,
      default: () => ({}),
    },

    // ============================================================
    // SECOND CHECK
    // ============================================================

    secondCheck: {
      type: checkSchema,
      default: () => ({}),
    },

    // ============================================================
    // OVERALL STATUS
    // ============================================================

    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Excused", "Not Marked"],
      default: "Not Marked",
    },
  },

  {
    timestamps: true,
  },
);

// ================================================================
// MAIN COHORT ATTENDANCE
//
// One student = one attendance record per main session.
// ================================================================

attendanceSchema.index(
  {
    studentId: 1,
    sessionId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: {
        $type: "objectId",
      },
    },
  },
);

// ================================================================
// TEAM MEETING ATTENDANCE
//
// One student = one record per batch + week + day.
// ================================================================

attendanceSchema.index(
  {
    studentId: 1,
    batchId: 1,
    week: 1,
    dayName: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: null,
    },
  },
);

module.exports =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
