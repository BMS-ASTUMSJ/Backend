const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const Document = require("../models/document.model");
const Chunk = require("../models/chunk.model");
const embeddingService = require("./embedding.service");
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
// VALIDATE DOCUMENT ID
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

  return String(content)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
};

// ============================================================
// CREATE TEXT CHUNKS
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

    // Try not to split words
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
// EXTRACT PDF
// ============================================================

const extractPdfText = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);

  const result = await pdfParse(buffer);

  return normalizeContent(result.text);
};

// ============================================================
// EXTRACT DOCX
// ============================================================

const extractDocxText = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);

  const result = await mammoth.extractRawText({
    buffer,
  });

  return normalizeContent(result.value);
};

// ============================================================
// EXTRACT TXT
// ============================================================

const extractTxtText = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);

  return normalizeContent(buffer.toString("utf8"));
};

// ============================================================
// EXTRACT FILE CONTENT
// ============================================================

const extractFileContent = async ({ filePath, extension }) => {
  const ext = String(extension || "").toLowerCase();

  if (ext === ".pdf") {
    return extractPdfText(filePath);
  }

  if (ext === ".docx") {
    return extractDocxText(filePath);
  }

  if (ext === ".txt") {
    return extractTxtText(filePath);
  }

  throw new Error(
    "Unsupported file type. Only PDF, DOCX, and TXT files are allowed.",
  );
};

// ============================================================
// CREATE TEXT DOCUMENT
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

  // ==========================================================
  // DUPLICATE CHECK
  // ==========================================================

  const existingDocument = await Document.findOne({
    fileHash,
  });

  if (existingDocument) {
    const error = new Error("A document with the same content already exists");

    error.statusCode = 409;

    error.document = existingDocument;

    throw error;
  }

  // ==========================================================
  // CREATE
  // ==========================================================

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
// UPLOAD DOCUMENT
// ============================================================

const uploadDocument = async ({
  file,
  title,
  uploadedBy = null,
  metadata = {},
}) => {
  if (!file) {
    const error = new Error("No document file was uploaded");

    error.statusCode = 400;

    throw error;
  }

  if (uploadedBy && !mongoose.Types.ObjectId.isValid(uploadedBy)) {
    throw new Error("Invalid user ID");
  }

  const extension = path.extname(file.originalname).toLowerCase();

  let type;

  if (extension === ".pdf") {
    type = "pdf";
  } else if (extension === ".docx") {
    type = "docx";
  } else if (extension === ".txt") {
    type = "txt";
  } else {
    const error = new Error(
      "Unsupported file type. Only PDF, DOCX, and TXT files are allowed.",
    );

    error.statusCode = 400;

    throw error;
  }

  let extractedContent = "";

  try {
    // ========================================================
    // EXTRACT CONTENT
    // ========================================================

    extractedContent = await extractFileContent({
      filePath: file.path,

      extension,
    });
  } catch (error) {
    console.error("Document extraction error:", error);

    // Delete unusable uploaded file
    await safeDeleteFile(file.path);

    const extractionError = new Error(
      `Failed to extract document text: ${error.message}`,
    );

    extractionError.statusCode = 400;

    throw extractionError;
  }

  if (!extractedContent) {
    await safeDeleteFile(file.path);

    const error = new Error("The uploaded document contains no readable text.");

    error.statusCode = 400;

    throw error;
  }

  // ========================================================
  // HASH EXTRACTED CONTENT
  // ========================================================

  const fileHash = generateFileHash(extractedContent);

  // ========================================================
  // DUPLICATE CHECK
  // ========================================================

  const existingDocument = await Document.findOne({
    fileHash,
  });

  if (existingDocument) {
    await safeDeleteFile(file.path);

    const error = new Error("A document with the same content already exists.");

    error.statusCode = 409;

    error.document = existingDocument;

    throw error;
  }

  // ========================================================
  // DEFAULT TITLE
  // ========================================================

  const defaultTitle = path.basename(file.originalname, extension);

  const cleanTitle = String(title || defaultTitle).trim();

  if (!cleanTitle) {
    await safeDeleteFile(file.path);

    throw new Error("Document title is required");
  }

  // ========================================================
  // CREATE DATABASE RECORD
  // ========================================================

  const document = await Document.create({
    title: cleanTitle,

    type,

    source: "upload",

    status: "processing",

    uploadedBy: uploadedBy || null,

    fileHash,

    rawContent: extractedContent,

    originalName: file.originalname,

    storedFileName: file.filename,

    filePath: file.path,

    mimeType: file.mimetype,

    fileSize: file.size,

    metadata: {
      ...metadata,

      originalName: file.originalname,

      extension,

      mimeType: file.mimetype,

      size: file.size,
    },
  });

  // ========================================================
  // PROCESS
  // ========================================================

  try {
    const result = await rebuildDocumentChunks(document._id);

    document.status = "processed";

    document.processingError = null;

    document.processedAt = new Date();

    await document.save();

    return {
      document,

      chunksCreated: result.chunksCreated,

      chunksEmbedded: result.chunksEmbedded,
    };
  } catch (error) {
    console.error("Uploaded document processing error:", error);

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
    .select("-filePath")
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

  const document = await Document.findOne(query).select("-filePath").lean();

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

  // ==========================================================
  // DELETE OLD CHUNKS
  // ==========================================================

  await Chunk.deleteMany({
    document: document._id,
  });

  // ==========================================================
  // CREATE NEW CHUNKS
  // ==========================================================

  const chunkDocuments = chunks.map((chunk) => ({
    document: document._id,

    content: chunk.content,

    chunkIndex: chunk.chunkIndex,

    startChar: chunk.startChar,

    endChar: chunk.endChar,

    embedding: [],
  }));

  await Chunk.insertMany(chunkDocuments);

  // ==========================================================
  // GENERATE EMBEDDINGS FOR THE NEW CHUNKS
  // ==========================================================

  console.log("==========================================");
  console.log("EMBEDDING NEW CHUNKS");
  console.log("==========================================");

  const embedResult = await embeddingService.embedDocumentChunks(document._id);

  console.log("Chunks embedded:", embedResult.processedChunks);
  console.log("==========================================");

  return {
    documentId: document._id,

    chunksCreated: chunkDocuments.length,

    chunksEmbedded: embedResult.processedChunks,
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

  // ==========================================================
  // DUPLICATE CHECK
  // ==========================================================

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

  // ==========================================================
  // UPDATE
  // ==========================================================

  document.title = cleanTitle;

  document.rawContent = cleanContent;

  document.fileHash = newHash;

  document.status = "processing";

  document.processingError = null;

  await document.save();

  // ==========================================================
  // REPROCESS
  // ==========================================================

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

      chunksEmbedded: result.chunksEmbedded,
    };
  } catch (error) {
    document.status = "failed";

    document.processingError = error.message;

    await document.save();

    throw error;
  }
};

// ============================================================
// SAFE DELETE FILE
// ============================================================

const safeDeleteFile = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to delete file:", error);
    }
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

  // ==========================================================
  // DELETE RAG CHUNKS
  // ==========================================================

  const chunkDeleteResult = await Chunk.deleteMany({
    document: document._id,
  });

  // ==========================================================
  // DELETE PHYSICAL FILE
  // ==========================================================

  if (document.filePath) {
    await safeDeleteFile(document.filePath);
  }

  // ==========================================================
  // DELETE DATABASE DOCUMENT
  // ==========================================================

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

  uploadDocument,

  getDocuments,

  getDocumentById,

  updateDocument,

  reprocessDocument,

  deleteDocument,

  rebuildDocumentChunks,

  createTextChunks,

  generateFileHash,

  extractFileContent,
};
