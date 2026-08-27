const mongoose = require("mongoose");

const mentorAssignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MentorAssignment",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    githubUrl: {
      type: String,
      required: true,
      trim: true,
    },

    liveDemoUrl: {
      type: String,
      default: "",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    feedback: {
      type: String,
      default: "",
      trim: true,
    },

    feedbackAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

mentorAssignmentSubmissionSchema.index(
  {
    assignment: 1,
    student: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model(
  "MentorAssignmentSubmission",
  mentorAssignmentSubmissionSchema,
);
