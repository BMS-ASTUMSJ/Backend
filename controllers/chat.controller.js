const chatService = require("../services/chat.service");

const getUserId = (req) => {
  if (!req.user) {
    return null;
  }

  if (req.user._id) {
    return req.user._id.toString();
  }

  if (req.user.id) {
    return req.user.id.toString();
  }

  if (req.user.userId) {
    return req.user.userId.toString();
  }

  return null;
};

const createChat = async (req, res) => {
  try {
    const userId = getUserId(req);

    console.log("==========================================");
    console.log("CREATE CHAT");
    console.log("==========================================");
    console.log("Authenticated user:", req.user);
    console.log("Resolved user ID:", userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const { title } = req.body;

    const chat = await chatService.createChat(userId, title || "New Chat");

    return res.status(201).json({
      success: true,
      message: "New chat created successfully",
      chat,
    });
  } catch (error) {
    console.error("Create chat error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create chat",
    });
  }
};

const getUserChats = async (req, res) => {
  try {
    const userId = getUserId(req);

    console.log("==========================================");
    console.log("GET USER CHATS");
    console.log("==========================================");
    console.log("Authenticated user ID:", userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const chats = await chatService.getUserChats(userId);

    return res.status(200).json({
      success: true,
      count: chats.length,
      chats,
    });
  } catch (error) {
    console.error("Get user chats error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load chats",
    });
  }
};

const getChatById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { chatId } = req.params;

    console.log("==========================================");
    console.log("GET CHAT");
    console.log("==========================================");
    console.log("User ID:", userId);
    console.log("Chat ID:", chatId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const result = await chatService.getChatById(chatId, userId);

    return res.status(200).json({
      success: true,
      chat: result.chat,
      messages: result.messages,
    });
  } catch (error) {
    console.error("Get chat error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to load chat",
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { chatId } = req.params;

    const { message, question, limit, minScore, documentId } = req.body;

    const userMessage = message || question;

    console.log("==========================================");
    console.log("SEND CHAT MESSAGE");
    console.log("==========================================");
    console.log("User ID:", userId);
    console.log("Chat ID:", chatId);
    console.log("Message:", userMessage);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    if (!userMessage || !String(userMessage).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const result = await chatService.sendMessage({
      chatId,
      userId,

      message: String(userMessage).trim(),

      limit: limit !== undefined ? Number(limit) : 5,

      minScore: minScore !== undefined ? Number(minScore) : 0.3,

      documentId: documentId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",

      chat: result.chat,

      userMessage: result.userMessage,

      assistantMessage: result.assistantMessage,

      rag: result.rag,
    });
  } catch (error) {
    console.error("Send chat message error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send chat message",
    });
  }
};

const deleteChat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { chatId } = req.params;

    console.log("==========================================");
    console.log("DELETE CHAT");
    console.log("==========================================");
    console.log("User ID:", userId);
    console.log("Chat ID:", chatId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    const result = await chatService.deleteChat(chatId, userId);

    return res.status(200).json({
      success: true,
      message: "Chat deleted successfully",
      chatId: result.chatId,
    });
  } catch (error) {
    console.error("Delete chat error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete chat",
    });
  }
};

const renameChat = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { chatId } = req.params;
    const { title } = req.body;

    console.log("==========================================");
    console.log("RENAME CHAT");
    console.log("==========================================");
    console.log("User ID:", userId);
    console.log("Chat ID:", chatId);
    console.log("New title:", title);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found",
      });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat title is required",
      });
    }

    const chat = await chatService.renameChat(
      chatId,
      userId,
      String(title).trim(),
    );

    return res.status(200).json({
      success: true,
      message: "Chat renamed successfully",
      chat,
    });
  } catch (error) {
    console.error("Rename chat error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to rename chat",
    });
  }
};

const answerPublicQuestion = async (req, res) => {
  try {
    const { message, limit, minScore, documentId } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const result = await chatService.answerPublicQuestion({
      message,
      limit,
      minScore,
      documentId,
    });

    return res.status(200).json({
      success: true,
      message: "Question answered successfully",

      answer: result.answer,

      sources: result.sources,

      model: result.model,

      rag: result.rag,
    });
  } catch (error) {
    console.error("Public AI question error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to answer question",
    });
  }
};
module.exports = {
  createChat,
  getUserChats,
  getChatById,
  sendMessage,
  deleteChat,
  answerPublicQuestion,
  renameChat,
};
