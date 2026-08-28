const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const chatController = require("../controllers/chat.controller");

// ======================================================
// PUBLIC AI ASSISTANT
// ======================================================
// No login required
// POST /api/chat/public
// ======================================================

router.post("/public", chatController.answerPublicQuestion);

// ======================================================
// PROTECTED CHAT ROUTES
// ======================================================
// Everything below this point requires login
// ======================================================

router.use(protect);

// ======================================================
// CREATE NEW CHAT
// POST /api/chat
// ======================================================

router.post("/", chatController.createChat);

// ======================================================
// GET ALL MY CHATS
// GET /api/chat
// ======================================================

router.get("/", chatController.getUserChats);

// ======================================================
// GET ONE CHAT + MESSAGES
// GET /api/chat/:chatId
// ======================================================

router.get("/:chatId", chatController.getChatById);

// ======================================================
// SEND MESSAGE
// POST /api/chat/:chatId/messages
// ======================================================

router.post("/:chatId/messages", chatController.sendMessage);

// ======================================================
// RENAME CHAT
// PATCH /api/chat/:chatId
// ======================================================

router.patch("/:chatId", chatController.renameChat);

// ======================================================
// DELETE CHAT
// DELETE /api/chat/:chatId
// ======================================================

router.delete("/:chatId", chatController.deleteChat);

module.exports = router;
