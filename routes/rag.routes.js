const express = require("express");

const router = express.Router();

const ragController = require("../controllers/rag.controller");

// Context only
router.post("/context", ragController.getRagContext);

// Full RAG question
router.post("/ask", ragController.askRagQuestion);

module.exports = router;
