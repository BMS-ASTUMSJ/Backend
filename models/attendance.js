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
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    week: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

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

    meetingType: {
      type: String,
      enum: [
        "Daily Meeting",
        "Sunday Weekly Meeting",
      ],
      required: true,
    },

    sessionType: {
      type: String,
      default: "Daily Meeting",
    },

    sessionName: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      default: Date.now,
    },

    firstCheck: {
      type: checkSchema,
      default: () => ({}),
    },

    secondCheck: {
      type: checkSchema,
      default: () => ({}),
    },

    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Late",
        "Excused",
        "Not Marked",
      ],
      default: "Not Marked",
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index(
  {
    studentId: 1,
    week: 1,
    dayName: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.models.Attendance ||
  mongoose.model("Attendance", attendanceSchema);