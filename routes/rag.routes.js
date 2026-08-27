const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const ragController = require("../controllers/rag.controller");

// ======================================================
// PROTECTED RAG ROUTES
// ======================================================

router.use(protect);

// Context only
router.post("/context", ragController.getRagContext);

// Full RAG question
router.post("/ask", ragController.askRagQuestion);

module.exports = router;
