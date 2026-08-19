const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    // Current Active Batch
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    // Historical batches the user was enrolled in (Supports alumni & past batch access)
    pastBatches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch",
      },
    ],

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    // Student / School ID
    schoolId: {
      type: String,
      default: "",
      trim: true,
    },

    // Coding & Competitive Programming Profiles
    githubUrl: {
      type: String,
      default: "",
      trim: true,
    },

    leetcodeUrl: {
      type: String,
      default: "",
      trim: true,
    },

    codeforcesUrl: {
      type: String,
      default: "",
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    profileImage: {
      type: String,
      default: null,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    googleId: {
      type: String,
      default: null,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["admin", "mentor", "student"],
      required: true,
    },

    // Mentors assigned to this student (Up to 2 mentors of matching gender)
    assignedMentors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Students assigned to this mentor (Of matching gender)
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["approved", "suspended"],
      default: "approved",
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    passwordResetOtp: {
      type: String,
      default: null,
    },

    passwordResetOtpExpires: {
      type: Date,
      default: null,
    },

    passwordResetVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup by role, gender, and batch
userSchema.index({ role: 1, gender: 1, batch: 1 });

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);