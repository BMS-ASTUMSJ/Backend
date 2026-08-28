const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
    },

    startChar: {
      type: Number,
      default: 0,
    },

    endChar: {
      type: Number,
      default: 0,
    },

    embedding: {
      type: [Number],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

chunkSchema.index({
  document: 1,
  chunkIndex: 1,
});

chunkSchema.index({
  document: 1,
  createdAt: 1,
});

module.exports = mongoose.model("Chunk", chunkSchema);
