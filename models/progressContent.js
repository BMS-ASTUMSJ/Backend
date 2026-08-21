const mongoose = require("mongoose");

const TOPICS = [
  "HTML / CSS",
  "JavaScript",
  "React",
  "Node.js",
  "Express.js",
  "MongoDB",
  "Git / GitHub",
];

const progressContentSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },

    type: {
      type: String,
      enum: ["cp", "dev"],
      required: true,
    },

    topic: {
      type: String,
      enum: TOPICS,
      default: "JavaScript",
    },

    week: {
      type: Number,
      required: true,
      min: 1,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    link: {
      type: String,
      required: true,
      trim: true,
    },

    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    publishedAt: {
      type: Date,
      default: Date.now,
    },

    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

progressContentSchema.index({
  batch: 1,
  type: 1,
  topic: 1,
  week: 1,
  isPublished: 1,
});

module.exports =
  mongoose.models.ProgressContent ||
  mongoose.model("ProgressContent", progressContentSchema);
