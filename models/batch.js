const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
    },

    isRegistrationOpen: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

batchSchema.index({ status: 1 });

module.exports = mongoose.models.Batch || mongoose.model("Batch", batchSchema);
