const crypto = require("crypto");
const mongoose = require("mongoose");

const Document = require("../models/document.model");
const Chunk = require("../models/chunk.model");

// ============================================================
// HASH CONTENT
// ============================================================

const generateFileHash = (content) => {
  return crypto
    .createHash("sha256")
    .update(String(content), "utf8")
    .digest("hex");
};

// ============================================================
// VALIDATE ID
// ============================================================

const validateDocumentId = (documentId) => {
  if (!documentId) {
    throw new Error("Document ID is required");
  }

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    const error = new Error("Invalid document ID");
    error.statusCode = 400;
    throw error;
  }
};

// ============================================================
// NORMALIZE CONTENT
// ============================================================

const normalizeContent = (content) => {
  if (content === undefined || content === null) {
    return "";
  }

  return String(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
};

// ============================================================
// CHUNK TEXT
// ============================================================
//
// This is a safe basic chunker.
//
// IMPORTANT:
// If your existing upload pipeline already has a chunking
// service, use that same chunking function instead of having
// two different chunking algorithms.
// ============================================================

const createTextChunks = ({ content, chunkSize = 1200, overlap = 200 }) => {
  const text = normalizeContent(content);

  if (!text) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("Chunk overlap must be >= 0 and smaller than chunk size");
  }

  const chunks = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try not to split in the middle of a word.
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);

      if (lastSpace > start + Math.floor(chunkSize * 0.5)) {
        end = lastSpace;
      }
    }

    const chunkContent = text.slice(start, end).trim();

    if (chunkContent) {
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startChar: start,
        endChar: end,
      });

      chunkIndex += 1;
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

// ============================================================
// CREATE DOCUMENT
// ============================================================

const createTextDocument = async ({
  title,
  content,
  uploadedBy = null,
  metadata = {},
  processChunks = true,
}) => {
  const cleanTitle = String(title || "").trim();
  const cleanContent = normalizeContent(content);

  if (!cleanTitle) {
    throw new Error("Title is required");
  }

  if (!cleanContent) {
    throw new Error("Content is required");
  }

  if (uploadedBy && !mongoose.Types.ObjectId.isValid(uploadedBy)) {
    throw new Error("Invalid user ID");
  }

  const fileHash = generateFileHash(cleanContent);

  // Prevent duplicate content.
  const existingDocument = await Document.findOne({
    fileHash,
  });

  if (existingDocument) {
    const error = new Error("A document with the same content already exists");

    error.statusCode = 409;
    error.document = existingDocument;

    throw error;
  }

  const document = await Document.create({
    title: cleanTitle,
    type: "text",
    source: "manual",
    status: "processing",
    uploadedBy: uploadedBy || null,
    fileHash,
    rawContent: cleanContent,
    metadata,
  });

  try {
    if (processChunks) {
      await rebuildDocumentChunks(document._id);
    }

    document.status = "processed";
    document.processingError = null;
    document.processedAt = new Date();

    await document.save();

    return document;
  } catch (error) {
    document.status = "failed";
    document.processingError = error.message;

    await document.save();

    throw error;
  }
};

// ============================================================
// LIST DOCUMENTS
// ============================================================

const getDocuments = async (userId = null) => {
  const query = {};

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    query.uploadedBy = userId;
  }

  return Document.find(query)
    .sort({
      createdAt: -1,
    })
    .lean();
};

// ============================================================
// GET ONE DOCUMENT
// ============================================================

const getDocumentById = async (documentId, userId = null) => {
  validateDocumentId(documentId);

  const query = {
    _id: documentId,
  };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    query.uploadedBy = userId;
  }

  const document = await Document.findOne(query).lean();

  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  return document;
};

// ============================================================
// REBUILD CHUNKS
// ============================================================
//
// Deletes ALL old chunks first and creates a fresh set.
//
// This prevents stale RAG data after an edit.
// ============================================================

const rebuildDocumentChunks = async (documentId) => {
  validateDocumentId(documentId);

  const document = await Document.findById(documentId);

  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  const content = normalizeContent(document.rawContent);

  if (!content) {
    throw new Error("Document has no content to process");
  }

  const chunks = createTextChunks({
    content,
    chunkSize: 1200,
    overlap: 200,
  });

  if (!chunks.length) {
    throw new Error("No chunks could be created");
  }

  // CRITICAL:
  // Remove old chunks before inserting new chunks.
  await Chunk.deleteMany({
    document: document._id,
  });

  const chunkDocuments = chunks.map((chunk) => ({
    document: document._id,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    startChar: chunk.startChar,
    endChar: chunk.endChar,

    // IMPORTANT:
    // This is empty here because the exact embedding
    // generator from your existing upload pipeline was not
    // included in the files you provided.
    //
    // Connect your existing embedding generator here.
    embedding: [],
  }));

  await Chunk.insertMany(chunkDocuments);

  return {
    documentId: document._id,
    chunksCreated: chunkDocuments.length,
  };
};

// ============================================================
// UPDATE DOCUMENT
// ============================================================

const updateDocument = async ({
  documentId,
  title,
  content,
  userId = null,
}) => {
  validateDocumentId(documentId);

  const query = {
    _id: documentId,
  };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    query.uploadedBy = userId;
  }

  const document = await Document.findOne(query);

  if (!document) {
    const error = new Error(
      "Document not found or you do not have permission to edit it",
    );

    error.statusCode = 404;

    throw error;
  }

  const cleanTitle =
    title !== undefined ? String(title).trim() : document.title;

  const cleanContent =
    content !== undefined ? normalizeContent(content) : document.rawContent;

  if (!cleanTitle) {
    throw new Error("Title is required");
  }

  if (!cleanContent) {
    throw new Error("Content is required");
  }

  const newHash = generateFileHash(cleanContent);

  // If content changed, check whether another document already
  // contains exactly the same content.
  if (newHash !== document.fileHash) {
    const duplicate = await Document.findOne({
      fileHash: newHash,
      _id: {
        $ne: document._id,
      },
    });

    if (duplicate) {
      const error = new Error(
        "Another document with the same content already exists",
      );

      error.statusCode = 409;
      throw error;
    }
  }

  document.title = cleanTitle;
  document.rawContent = cleanContent;
  document.fileHash = newHash;
  document.status = "processing";
  document.processingError = null;

  await document.save();

  try {
    await rebuildDocumentChunks(document._id);

    document.status = "processed";
    document.processingError = null;
    document.processedAt = new Date();

    await document.save();

    return document;
  } catch (error) {
    document.status = "failed";
    document.processingError = error.message;

    await document.save();

    throw error;
  }
};

// ============================================================
// REPROCESS DOCUMENT
// ============================================================

const reprocessDocument = async ({ documentId, userId = null }) => {
  validateDocumentId(documentId);

  const query = {
    _id: documentId,
  };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    query.uploadedBy = userId;
  }

  const document = await Document.findOne(query);

  if (!document) {
    const error = new Error(
      "Document not found or you do not have permission to reprocess it",
    );

    error.statusCode = 404;

    throw error;
  }

  document.status = "processing";
  document.processingError = null;

  await document.save();

  try {
    const result = await rebuildDocumentChunks(document._id);

    document.status = "processed";
    document.processingError = null;
    document.processedAt = new Date();

    await document.save();

    return {
      document,
      chunksCreated: result.chunksCreated,
    };
  } catch (error) {
    document.status = "failed";
    document.processingError = error.message;

    await document.save();

    throw error;
  }
};

// ============================================================
// DELETE DOCUMENT
// ============================================================

const deleteDocument = async ({ documentId, userId = null }) => {
  validateDocumentId(documentId);

  const query = {
    _id: documentId,
  };

  if (userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    query.uploadedBy = userId;
  }

  const document = await Document.findOne(query);

  if (!document) {
    const error = new Error(
      "Document not found or you do not have permission to delete it",
    );

    error.statusCode = 404;

    throw error;
  }

  // Delete all RAG chunks FIRST.
  const chunkDeleteResult = await Chunk.deleteMany({
    document: document._id,
  });

  // Then delete document.
  await Document.deleteOne({
    _id: document._id,
  });

  return {
    documentId: document._id,
    chunksDeleted: chunkDeleteResult.deletedCount || 0,
  };
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createTextDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  reprocessDocument,
  deleteDocument,
  rebuildDocumentChunks,
  createTextChunks,
  generateFileHash,
};
