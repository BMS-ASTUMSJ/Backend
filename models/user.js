const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ============================================================
    // BASIC INFORMATION
    // ============================================================

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

    // ============================================================
    // ROLE & STATUS
    // ============================================================

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

    // ============================================================
    // GENDER
    // ============================================================

    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    // ============================================================
    // CONTACT INFORMATION
    // ============================================================

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

    // ============================================================
    // PROFILE
    // ============================================================

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    profileImage: {
      url: {
        type: String,
        default: "",
        trim: true,
      },

      publicId: {
        type: String,
        default: "",
        trim: true,
      },
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

    // ============================================================
    // CURRENT BATCH
    // ============================================================

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
    },

    // ============================================================
    // BATCH HISTORY
    // ============================================================

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

    // ============================================================
    // OLD / BACKWARD COMPATIBILITY
    // ============================================================

    pastBatches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch",
      },
    ],

    // ============================================================
    // MENTOR / STUDENT ASSIGNMENTS
    // ============================================================

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

    // ============================================================
    // AT RISK
    // ============================================================

    /*
      false = normal student
      true  = student is at risk
    */

    atRisk: {
      type: Boolean,
      default: false,
    },

    // ============================================================
    // PASSWORD RESET
    // ============================================================

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

// ============================================================
// INDEXES
// ============================================================

userSchema.index({
  role: 1,
  gender: 1,
  batch: 1,
});

userSchema.index({
  role: 1,
  assignedStudents: 1,
});

userSchema.index({
  role: 1,
  assignedMentors: 1,
});

userSchema.index({
  role: 1,
  atRisk: 1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
