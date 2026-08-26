const express = require("express");

const router = express.Router();

const retrievalController = require("../controllers/retrieval.controller");

// ======================================================
// VECTOR SEARCH
// ======================================================

router.post("/search", retrievalController.searchDocuments);

module.exports = router;
