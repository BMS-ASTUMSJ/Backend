const mongoose = require("mongoose");

// ======================================================
// DOCUMENT SCHEMA
// ======================================================

const documentSchema = new mongoose.Schema(
  {
    // ====================================================
    // BASIC INFORMATION
    // ====================================================

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ====================================================
    // DOCUMENT TYPE
    // ====================================================

    type: {
      type: String,
      required: true,

      enum: ["pdf", "docx", "txt", "text"],
    },

    // ====================================================
    // SOURCE
    // ====================================================

    source: {
      type: String,

      required: true,

      enum: ["upload", "manual"],

      default: "upload",
    },

    // ====================================================
    // PROCESSING STATUS
    // ====================================================

    status: {
      type: String,

      enum: ["processing", "processed", "failed"],

      default: "processing",

      index: true,
    },

    // ====================================================
    // UPLOADED BY
    // ====================================================

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      default: null,

      index: true,
    },

    // ====================================================
    // DUPLICATE HASH
    // ====================================================

    fileHash: {
      type: String,

      required: true,

      unique: true,

      index: true,

      trim: true,
    },

    // ====================================================
    // EXTRACTED TEXT
    // ====================================================

    rawContent: {
      type: String,

      default: null,
    },

    // ====================================================
    // ORIGINAL FILE INFORMATION
    // ====================================================

    originalName: {
      type: String,

      default: null,
    },

    storedFileName: {
      type: String,

      default: null,
    },

    filePath: {
      type: String,

      default: null,
    },

    mimeType: {
      type: String,

      default: null,
    },

    fileSize: {
      type: Number,

      default: 0,
    },

    // ====================================================
    // EXTRA METADATA
    // ====================================================

    metadata: {
      type: mongoose.Schema.Types.Mixed,

      default: {},
    },

    // ====================================================
    // PROCESSING INFORMATION
    // ====================================================

    processedAt: {
      type: Date,

      default: null,
    },

    processingError: {
      type: String,

      default: null,
    },
  },

  {
    timestamps: true,
  },
);

// ======================================================
// INDEXES
// ======================================================

documentSchema.index({
  uploadedBy: 1,
  createdAt: -1,
});
// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model("Document", documentSchema);
