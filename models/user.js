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

    // Current batch
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    // Complete batch membership history
    batchHistory: [
      {
        batch: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Batch",
          required: true,
        },

        role: {
          type: String,
          enum: ["mentor", "student"],
          required: true,
        },

        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    schoolId: {
      type: String,
      default: "",
      trim: true,
    },

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

    assignedMentors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

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
  },
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
