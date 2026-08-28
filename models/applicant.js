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

    schoolId: {
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
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"],
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    experienceLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },

    githubUrl: {
      type: String,
      required: true,
      trim: true,
    },

    leetcodeUrl: {
      type: String,
      required: true,
      trim: true,
    },

    codeforcesUrl: {
      type: String,
      required: true,
      trim: true,
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

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
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
  },
);

module.exports =
  mongoose.models.Applicant || mongoose.model("Applicant", applicantSchema);
