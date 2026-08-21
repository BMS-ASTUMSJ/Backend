const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },

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

    date: {
      type: Date,
      required: true,
      index: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

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
