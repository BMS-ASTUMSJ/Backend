const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },

    mentors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    projectTitle: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Team || mongoose.model("Team", teamSchema);
