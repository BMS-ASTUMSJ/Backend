const mongoose = require("mongoose");

const documentService = require("../services/document.service");

// ============================================================
// CREATE MANUAL TEXT DOCUMENT
// ============================================================

const createDocument = async (req, res) => {
  try {
    const { title, content, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,

        message: "Title and content are required",
      });
    }

    const document = await documentService.createTextDocument({
      title,

      content,

      uploadedBy: req.user?._id || null,

      metadata: metadata || {},
    });

    return res.status(201).json({
      success: true,

      message: "Document created and processed successfully",

      document,
    });
  } catch (error) {
    console.error("Create document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to create document",
    });
  }
};

// ============================================================
// UPLOAD DOCUMENT
// POST /api/documents/upload
// ============================================================

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,

        message: "Please select a PDF, DOCX, or TXT file",
      });
    }

    const { title } = req.body;

    const document = await documentService.uploadDocument({
      file: req.file,

      title,

      uploadedBy: req.user?._id || null,

      metadata: {},
    });

    return res.status(201).json({
      success: true,

      message:
        "Document uploaded, extracted, chunked, and processed successfully",

      document: document.document,

      chunksCreated: document.chunksCreated,
    });
  } catch (error) {
    console.error("Upload document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to upload document",
    });
  }
};

// ============================================================
// GET ALL
// ============================================================

const getDocuments = async (req, res) => {
  try {
    const userId = req.user?._id || null;

    const documents = await documentService.getDocuments(userId);

    return res.status(200).json({
      success: true,

      count: documents.length,

      documents,
    });
  } catch (error) {
    console.error("Get documents error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to load documents",
    });
  }
};

// ============================================================
// GET ONE
// ============================================================

const getDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,

        message: "Invalid document ID",
      });
    }

    const document = await documentService.getDocumentById(
      documentId,

      req.user?._id || null,
    );

    return res.status(200).json({
      success: true,

      document,
    });
  } catch (error) {
    console.error("Get document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to load document",
    });
  }
};

// ============================================================
// UPDATE
// ============================================================

const updateDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const { title, content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,

        message: "Invalid document ID",
      });
    }

    if (title === undefined && content === undefined) {
      return res.status(400).json({
        success: false,

        message: "At least title or content is required",
      });
    }

    const document = await documentService.updateDocument({
      documentId,

      title,

      content,

      userId: req.user?._id || null,
    });

    return res.status(200).json({
      success: true,

      message: "Document updated and reprocessed successfully",

      document,
    });
  } catch (error) {
    console.error("Update document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to update document",
    });
  }
};

// ============================================================
// REPROCESS
// ============================================================

const reprocessDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,

        message: "Invalid document ID",
      });
    }

    const result = await documentService.reprocessDocument({
      documentId,

      userId: req.user?._id || null,
    });

    return res.status(200).json({
      success: true,

      message: "Document reprocessed successfully",

      document: result.document,

      chunksCreated: result.chunksCreated,
    });
  } catch (error) {
    console.error("Reprocess document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to reprocess document",
    });
  }
};

// ============================================================
// DELETE
// ============================================================

const deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,

        message: "Invalid document ID",
      });
    }

    const result = await documentService.deleteDocument({
      documentId,

      userId: req.user?._id || null,
    });

    return res.status(200).json({
      success: true,

      message: "Document, chunks, and uploaded file deleted successfully",

      documentId: result.documentId,

      chunksDeleted: result.chunksDeleted,
    });
  } catch (error) {
    console.error("Delete document error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,

      message: error.message || "Failed to delete document",
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createDocument,

  uploadDocument,

  getDocuments,

  getDocument,

  updateDocument,

  reprocessDocument,

  deleteDocument,
};
