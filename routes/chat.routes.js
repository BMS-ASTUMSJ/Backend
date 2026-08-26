const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const chatController = require("../controllers/chat.controller");

// ======================================================
// ALL CHAT ROUTES REQUIRE LOGIN
// ======================================================

router.use(protect);

// ======================================================
// CREATE NEW CHAT
// POST /api/chats
// ======================================================

router.post("/", chatController.createChat);

// ======================================================
// GET ALL MY CHATS
// GET /api/chats
// ======================================================

router.get("/", chatController.getUserChats);

// ======================================================
// GET ONE CHAT + MESSAGES
// GET /api/chats/:chatId
// ======================================================

router.get("/:chatId", chatController.getChatById);

// ======================================================
// SEND MESSAGE
// POST /api/chats/:chatId/messages
// ======================================================

router.post("/:chatId/messages", chatController.sendMessage);

// ======================================================
// RENAME CHAT
// PATCH /api/chats/:chatId
// ======================================================

router.patch("/:chatId", chatController.renameChat);

// ======================================================
// DELETE CHAT
// DELETE /api/chats/:chatId
// ======================================================

router.delete("/:chatId", chatController.deleteChat);

module.exports = router;
