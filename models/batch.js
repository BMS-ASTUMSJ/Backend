const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true, // e.g. "Batch 1", "Batch 2"
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "active",
    },

    isRegistrationOpen: {
      type: Boolean,
      default: false,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Batch || mongoose.model("Batch", batchSchema);
