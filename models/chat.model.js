const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "New Chat",
      trim: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    archived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

chatSchema.index({
  user: 1,
  updatedAt: -1,
});

module.exports = mongoose.model("Chat", chatSchema);
