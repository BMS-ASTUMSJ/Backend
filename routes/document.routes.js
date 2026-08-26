const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const documentController = require("../controllers/document.controller");

// ============================================================
// CREATE
// POST /api/documents
// ============================================================

router.post("/", protect, documentController.createDocument);

// ============================================================
// GET ALL
// GET /api/documents
// ============================================================

router.get("/", protect, documentController.getDocuments);

// ============================================================
// GET ONE
// GET /api/documents/:documentId
// ============================================================

router.get("/:documentId", protect, documentController.getDocument);

// ============================================================
// UPDATE
// PUT /api/documents/:documentId
// ============================================================

router.put("/:documentId", protect, documentController.updateDocument);

// ============================================================
// REPROCESS
// POST /api/documents/:documentId/reprocess
// ============================================================

router.post(
  "/:documentId/reprocess",
  protect,
  documentController.reprocessDocument,
);

// ============================================================
// DELETE
// DELETE /api/documents/:documentId
// ============================================================

router.delete("/:documentId", protect, documentController.deleteDocument);

module.exports = router;
