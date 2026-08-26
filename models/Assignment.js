const mongoose = require("mongoose");

const assignmentFileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const assignmentSchema = new mongoose.Schema(
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
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    maxScore: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
    },
    link: {
      type: String,
      default: "",
      trim: true,
    },
    files: {
      type: [assignmentFileSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ batch: 1, deadline: 1 });

module.exports = mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);