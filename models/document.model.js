const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,

      enum: ["pdf", "docx", "txt", "text"],
    },

    source: {
      type: String,

      required: true,

      enum: ["upload", "manual"],

      default: "upload",
    },

    status: {
      type: String,

      enum: ["processing", "processed", "failed"],

      default: "processing",

      index: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      default: null,

      index: true,
    },

    fileHash: {
      type: String,

      required: true,

      unique: true,

      index: true,

      trim: true,
    },

    rawContent: {
      type: String,

      default: null,
    },

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

    metadata: {
      type: mongoose.Schema.Types.Mixed,

      default: {},
    },

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

documentSchema.index({
  uploadedBy: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Document", documentSchema);
