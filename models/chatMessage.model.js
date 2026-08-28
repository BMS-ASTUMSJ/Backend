const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    sources: [
      {
        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },

        chunkId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Chunk",
        },

        chunkIndex: Number,

        score: Number,

        sourceNumber: Number,
      },
    ],

    model: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

chatMessageSchema.index({
  chat: 1,
  createdAt: 1,
});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
