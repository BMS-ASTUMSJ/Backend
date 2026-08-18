const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    sessionType: {
      type: String,
      enum: ["Lecture", "Experience Sharing", "Contest"],
      required: true,
    },

    sessionName: {
      type: String,
      enum: ["Lecture 1", "Lecture 2", "Experience Sharing", "Contest"],
      required: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    firstCheck: {
      status: {
        type: String,
        enum: ["Present", "Absent", "Late", "Excused"],
        default: "Absent",
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
        default: "Absent",
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
    batchId: 1,
    date: 1,
    sessionName: 1,
  },
  {
    unique: true,
  },
);

module.exports =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
