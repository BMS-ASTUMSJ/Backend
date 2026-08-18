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
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Announcement", announcementSchema);
