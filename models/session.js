const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    week: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    type: {
      type: String,
      enum: ["Lecture", "Experience Sharing", "Contest"],
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 1,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index(
  { batch: 1, week: 1, name: 1 },
  {
    unique: true,
    name: "batch_week_name_unique",
  },
);

module.exports =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
