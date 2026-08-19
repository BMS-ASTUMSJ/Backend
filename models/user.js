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

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      select: false,
    },

    googleId: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: ["admin", "mentor", "student"],
      required: true,
    },

    status: {
      type: String,
      enum: ["approved", "suspended"],
      default: "approved",
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
    },

    assignedMentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Current batch
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    // Previous batches
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

    // Password reset
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

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);