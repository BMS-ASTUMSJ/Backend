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
      index: true,
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

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

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

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    profileImage: {
      type: String,
      default: "",
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

    // Current batch
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    // User's previous/current batch history
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

    // Kept for backward compatibility
    pastBatches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch",
      },
    ],

    // Mentor assigned to a student
    assignedMentors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Students assigned to a mentor
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
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
  },
);

userSchema.index({
  role: 1,
  gender: 1,
  batch: 1,
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
