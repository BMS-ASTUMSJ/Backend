const mongoose = require("mongoose");

const mentorAssignmentFileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },

    mimetype: {
      type: String,
      default: "",
      trim: true,
    },

    size: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  },
);

const mentorAssignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    instructorName: {
      type: String,
      required: true,
      trim: true,
    },

    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deadline: {
      type: Date,
      required: true,
    },

    link: {
      type: String,
      default: "",
      trim: true,
    },

    files: {
      type: [mentorAssignmentFileSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

mentorAssignmentSchema.index({
  mentor: 1,
  createdAt: -1,
});

mentorAssignmentSchema.index({
  assignedStudents: 1,
  createdAt: -1,
});

mentorAssignmentSchema.index({
  deadline: 1,
});

module.exports = mongoose.model("MentorAssignment", mentorAssignmentSchema);
