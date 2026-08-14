const mongoose = require("mongoose");

const applicantSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    year: {
      type: String,
      enum: ["1st Year", "2nd Year", "3rd Year"],
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    experienceLevel: {
      type: String,
      enum: ["Beginner", "Intermediate"],
      required: true,
    },

    about: {
      type: String,
      required: true,
      trim: true,
    },

    agreedToRules: {
      type: Boolean,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "passed", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Applicant", applicantSchema);