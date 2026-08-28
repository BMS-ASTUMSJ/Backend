const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminOnly");

const upload = require("../middleware/ragUpload");

const documentController = require("../controllers/document.controller");

// ============================================================
// ADMIN DOCUMENT MANAGEMENT
// ============================================================

// ------------------------------------------------------------
// CREATE TEXT DOCUMENT
// POST /api/documents
// ------------------------------------------------------------

router.post("/", protect, adminOnly, documentController.createDocument);

// ------------------------------------------------------------
// UPLOAD DOCUMENT
// POST /api/documents/upload
//
// Supported:
// PDF
// TXT
// DOC
// DOCX
// ------------------------------------------------------------

router.post(
  "/upload",
  protect,
  adminOnly,
  upload.single("file"),
  documentController.uploadDocument,
);

// ------------------------------------------------------------
// GET ALL DOCUMENTS
// GET /api/documents
// ------------------------------------------------------------

router.get("/", protect, adminOnly, documentController.getDocuments);

// ------------------------------------------------------------
// GET ONE DOCUMENT
// GET /api/documents/:documentId
// ------------------------------------------------------------

router.get("/:documentId", protect, adminOnly, documentController.getDocument);

// ------------------------------------------------------------
// UPDATE DOCUMENT
// PUT /api/documents/:documentId
// ------------------------------------------------------------

router.put(
  "/:documentId",
  protect,
  adminOnly,
  documentController.updateDocument,
);

// ------------------------------------------------------------
// REPROCESS DOCUMENT
// POST /api/documents/:documentId/reprocess
// ------------------------------------------------------------

router.post(
  "/:documentId/reprocess",
  protect,
  adminOnly,
  documentController.reprocessDocument,
);

// ------------------------------------------------------------
// DELETE DOCUMENT
// DELETE /api/documents/:documentId
// ------------------------------------------------------------

router.delete(
  "/:documentId",
  protect,
  adminOnly,
  documentController.deleteDocument,
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
