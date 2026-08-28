const mongoose = require("mongoose");

const Chat = require("../models/chat.model");
const ChatMessage = require("../models/chatMessage.model");
const ragService = require("./rag.service");

// ======================================================
// CREATE CHAT
// ======================================================

const createChat = async (userId, title = "New Chat") => {
  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  const chatTitle =
    title && String(title).trim()
      ? String(title).trim().substring(0, 100)
      : "New Chat";

  const chat = await Chat.create({
    user: userId,
    title: chatTitle,
    lastMessageAt: new Date(),
  });

  return chat;
};

// ======================================================
// GET USER CHATS
// ======================================================

const getUserChats = async (userId) => {
  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  const chats = await Chat.find({
    user: userId,
    archived: false,
  })
    .sort({
      lastMessageAt: -1,
      updatedAt: -1,
    })
    .lean();

  return chats;
};

// ======================================================
// GET SINGLE CHAT
// ======================================================

const getChatById = async (chatId, userId) => {
  if (!chatId) {
    throw new Error("Chat ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  // ====================================================
  // FIND CHAT OWNED BY CURRENT USER
  // ====================================================

  const chat = await Chat.findOne({
    _id: chatId,
    user: userId,
    archived: false,
  }).lean();

  if (!chat) {
    const error = new Error(
      "Chat not found or you do not have permission to access it",
    );

    error.statusCode = 404;

    throw error;
  }

  // ====================================================
  // GET MESSAGES
  // ====================================================

  const messages = await ChatMessage.find({
    chat: chatId,
    user: userId,
  })
    .sort({
      createdAt: 1,
    })
    .lean();

  return {
    chat,
    messages,
  };
};

// ======================================================
// GENERATE CHAT TITLE
// ======================================================

const generateChatTitle = (message) => {
  if (!message) {
    return "New Chat";
  }

  let title = String(message).replace(/\s+/g, " ").trim();

  if (!title) {
    return "New Chat";
  }

  // Remove question mark and similar punctuation
  title = title.replace(/[?!.]+$/g, "");

  // Maximum title length
  if (title.length > 60) {
    title = `${title.substring(0, 57)}...`;
  }

  return title;
};

// ======================================================
// SEND MESSAGE
// ======================================================

const sendMessage = async ({
  chatId,
  userId,
  message,
  limit = 5,
  minScore = 0.5,
  documentId = null,
}) => {
  // ====================================================
  // VALIDATION
  // ====================================================

  if (!chatId) {
    throw new Error("Chat ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID");
  }

  if (!message || !String(message).trim()) {
    throw new Error("Message is required");
  }

  const cleanMessage = String(message).trim();

  // ====================================================
  // FIND CHAT
  // ====================================================

  const chat = await Chat.findOne({
    _id: chatId,
    user: userId,
    archived: false,
  });

  if (!chat) {
    const error = new Error(
      "Chat not found or you do not have permission to access it",
    );

    error.statusCode = 404;

    throw error;
  }

  // ====================================================
  // CHECK WHETHER THIS IS FIRST MESSAGE
  // ====================================================

  const existingMessageCount = await ChatMessage.countDocuments({
    chat: chatId,
  });

  // ====================================================
  // SAVE USER MESSAGE
  // ====================================================

  const userMessage = await ChatMessage.create({
    chat: chatId,
    user: userId,
    role: "user",
    content: cleanMessage,
    sources: [],
    model: null,
  });

  // ====================================================
  // RUN RAG
  // ====================================================

  console.log("==========================================");
  console.log("CHAT RAG REQUEST");
  console.log("==========================================");

  console.log("User:", userId);
  console.log("Chat:", chatId);
  console.log("Question:", cleanMessage);

  const ragResult = await ragService.answerQuestion(cleanMessage, {
    limit:
      Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 5,

    minScore:
      minScore !== undefined && minScore !== null && minScore !== ""
        ? Number(minScore)
        : 0.5,

    documentId: documentId || null,
  });

  // ====================================================
  // SAVE ASSISTANT MESSAGE
  // ====================================================

  const assistantMessage = await ChatMessage.create({
    chat: chatId,
    user: userId,
    role: "assistant",
    content: ragResult.answer,
    sources: (ragResult.sources || []).map((source) => ({
      documentId: source.documentId,
      chunkId: source.chunkId,
      chunkIndex: source.chunkIndex,
      score: source.score,
      sourceNumber: source.sourceNumber,
    })),
    model: ragResult.model || null,
  });

  // ====================================================
  // UPDATE CHAT
  // ====================================================

  chat.lastMessageAt = new Date();

  // Automatically name chat after first question
  if (existingMessageCount === 0 || !chat.title || chat.title === "New Chat") {
    chat.title = generateChatTitle(cleanMessage);
  }

  await chat.save();

  // ====================================================
  // RETURN
  // ====================================================

  return {
    chat: {
      id: chat._id,
      title: chat.title,
      lastMessageAt: chat.lastMessageAt,
      updatedAt: chat.updatedAt,
    },

    userMessage: {
      id: userMessage._id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },

    assistantMessage: {
      id: assistantMessage._id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      sources: assistantMessage.sources,
      model: assistantMessage.model,
      createdAt: assistantMessage.createdAt,
    },

    // ==================================================
    // RAG INFORMATION
    // ==================================================

    rag: {
      retrievedChunks: ragResult.retrievedChunks,
      queryEmbeddingDimensions: ragResult.queryEmbeddingDimensions,
      sources: ragResult.sources || [],
    },
  };
};

// ======================================================
// DELETE CHAT
// ======================================================

const deleteChat = async (chatId, userId) => {
  if (!chatId) {
    throw new Error("Chat ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  // ====================================================
  // FIND OWNED CHAT
  // ====================================================

  const chat = await Chat.findOne({
    _id: chatId,
    user: userId,
  });

  if (!chat) {
    const error = new Error(
      "Chat not found or you do not have permission to delete it",
    );

    error.statusCode = 404;

    throw error;
  }

  // ====================================================
  // DELETE ALL MESSAGES
  // ====================================================

  await ChatMessage.deleteMany({
    chat: chatId,
  });

  // ====================================================
  // DELETE CHAT
  // ====================================================

  await Chat.deleteOne({
    _id: chatId,
    user: userId,
  });

  return {
    chatId,
  };
};

// ======================================================
// RENAME CHAT
// ======================================================

const renameChat = async (chatId, userId, title) => {
  if (!chatId) {
    throw new Error("Chat ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID");
  }

  if (!userId) {
    throw new Error("Authenticated user is required");
  }

  if (!title || !String(title).trim()) {
    throw new Error("Chat title is required");
  }

  const chat = await Chat.findOne({
    _id: chatId,
    user: userId,
    archived: false,
  });

  if (!chat) {
    const error = new Error(
      "Chat not found or you do not have permission to modify it",
    );

    error.statusCode = 404;

    throw error;
  }

  chat.title = String(title).trim().substring(0, 100);

  await chat.save();

  return chat;
};

// ======================================================
// EXPORT
// ======================================================
// ======================================================
// PUBLIC AI QUESTION
// ======================================================

const answerPublicQuestion = async ({
  message,
  limit = 5,
  minScore = 0.5,
  documentId = null,
}) => {
  // ====================================================
  // VALIDATION
  // ====================================================

  if (!message || !String(message).trim()) {
    throw new Error("Message is required");
  }

  const cleanMessage = String(message).trim();

  // ====================================================
  // RUN RAG
  // ====================================================

  console.log("==========================================");
  console.log("PUBLIC AI REQUEST");
  console.log("==========================================");

  console.log("Question:", cleanMessage);

  const ragResult = await ragService.answerQuestion(cleanMessage, {
    limit:
      Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 5,

    minScore:
      minScore !== undefined && minScore !== null && minScore !== ""
        ? Number(minScore)
        : 0.5,

    documentId: documentId || null,
  });

  // ====================================================
  // RETURN
  // ====================================================

  return {
    answer: ragResult.answer,

    sources: ragResult.sources || [],

    model: ragResult.model || null,

    rag: {
      retrievedChunks: ragResult.retrievedChunks,
      queryEmbeddingDimensions: ragResult.queryEmbeddingDimensions,
      sources: ragResult.sources || [],
    },
  };
};
module.exports = {
  createChat,
  getUserChats,
  getChatById,
  sendMessage,
  answerPublicQuestion,
  deleteChat,
  renameChat,
};
