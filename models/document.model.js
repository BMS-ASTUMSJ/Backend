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
    },

    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    fileHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    rawContent: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Useful for knowing when RAG processing last succeeded.
    processedAt: {
      type: Date,
      default: null,
    },

    // Optional processing error information.
    processingError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

documentSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);
