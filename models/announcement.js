const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    body: {
      type: String,
      required: true,
      trim: true,
    },

    audience: {
      type: String,
      enum: ["all", "mentor"],
      default: "all",
      required: true,
    },

    // Current batch
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Useful for fetching announcements for a batch
announcementSchema.index({ batch: 1, createdAt: -1 });

module.exports =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", announcementSchema);