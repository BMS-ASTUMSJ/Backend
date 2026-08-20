const mongoose = require("mongoose");

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
    // BATCH
    // ============================================================

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    // ============================================================
    // TEAM
    // ============================================================

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },

    // ============================================================
    // SESSION
    // ============================================================
    //
    // This is now a REAL reference to the Session collection.
    // Sessions are created by Admins (see sessionController.js /
    // Session model) with a dynamic count of lectures per week —
    // there is no fixed "Lecture 1 / Lecture 2" enum anymore.
    //
    // sessionType / sessionName / week / date below are
    // denormalized copies taken from the Session at the moment
    // attendance is marked, purely so reporting/stat queries
    // (admin dashboards) don't need to populate + join every time.
    // ============================================================

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },

    week: {
      type: Number,
      required: true,
      index: true,
    },

    sessionType: {
      type: String,
      required: true,
      trim: true,
    },

    sessionName: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // DATE (copied from the session at mark-time)
    // ============================================================

    date: {
      type: Date,
      required: true,
      index: true,
    },

    // ============================================================
    // STUDENT INFORMATION
    // ============================================================

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    // ============================================================
    // FIRST CHECK
    // ============================================================

    /*
      First attendance check for this session.

      Example:
      Session starts at 9:00
      First check can be performed according
      to the session attendance window.
    */

    firstCheck: {
      status: {
        type: String,
        enum: ["Present", "Absent", "Late", "Excused"],
        default: null,
      },

      markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      timestamp: {
        type: Date,
      },
    },

    // ============================================================
    // SECOND CHECK
    // ============================================================

    /*
      Second attendance check for the SAME session.

      This is not a second session.

      It is the second attendance check of the session.
    */

    secondCheck: {
      status: {
        type: String,
        enum: ["Present", "Absent", "Late", "Excused"],
        default: null,
      },

      markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      timestamp: {
        type: Date,
      },
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// ONE RECORD PER STUDENT + SESSION
// ============================================================
//
// A Session document already uniquely identifies
// batch + week + name (see session.js), so we no longer need
// date/batchId in this compound key — sessionId alone (plus the
// student/team) is enough to guarantee one attendance record per
// student per session.
// ============================================================

attendanceSchema.index(
  {
    studentId: 1,
    teamId: 1,
    sessionId: 1,
  },
  {
    unique: true,
    name: "student_team_session_unique",
  },
);

module.exports =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
