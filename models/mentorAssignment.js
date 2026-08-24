const mongoose = require("mongoose");

// ======================================================
// MENTOR ASSIGNMENT FILE SCHEMA
// ======================================================

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

// ======================================================
// MENTOR ASSIGNMENT SCHEMA
// ======================================================

const mentorAssignmentSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // ASSIGNMENT TITLE
    // --------------------------------------------------

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    description: {
      type: String,
      required: true,
      trim: true,
    },

    // --------------------------------------------------
    // INSTRUCTOR NAME
    // --------------------------------------------------

    instructorName: {
      type: String,
      required: true,
      trim: true,
    },

    // --------------------------------------------------
    // MENTOR WHO CREATED THE ASSIGNMENT
    // --------------------------------------------------

    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // STUDENTS WHO RECEIVE THE ASSIGNMENT
    //
    // These are automatically taken from the mentor's
    // assignedStudents list when the assignment is created.
    // --------------------------------------------------

    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // --------------------------------------------------
    // DEADLINE
    // --------------------------------------------------

    deadline: {
      type: Date,
      required: true,
    },

    // --------------------------------------------------
    // OPTIONAL EXTERNAL LINK
    // --------------------------------------------------

    link: {
      type: String,
      default: "",
      trim: true,
    },

    // --------------------------------------------------
    // UPLOADED FILES
    // --------------------------------------------------

    files: {
      type: [mentorAssignmentFileSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// ======================================================
// INDEXES
// ======================================================

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

// ======================================================
// EXPORT
// ======================================================

module.exports = mongoose.model("MentorAssignment", mentorAssignmentSchema);
