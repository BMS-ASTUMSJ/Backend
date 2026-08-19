const mongoose = require("mongoose");

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

  
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ batch: 1, deadline: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);