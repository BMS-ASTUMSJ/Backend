const extractionService = require("../services/extraction.service");
const chunkService = require("../services/chunk.service");
const embeddingService = require("../services/embedding.service");
const crypto = require("crypto");
const fs = require("fs");

const Document = require("../models/document.model");
const Chunk = require("../models/chunk.model");

/**
 * Extract text from an uploaded document,
 * clean it, create chunks, generate embeddings,
 * and save everything.
 */
const extractDocumentText = async (req, res) => {
  let document = null;

  try {
    // ==========================================
    // CHECK UPLOADED FILE
    // ==========================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }

    // ==========================================
    // READ FILE
    // ==========================================

    const fileBuffer = fs.readFileSync(req.file.path);

    // ==========================================
    // GENERATE SHA-256 FILE HASH
    // ==========================================

    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    console.log("==========================================");
    console.log("FILE HASH");
    console.log("==========================================");
    console.log("SHA-256:", fileHash);
    console.log("==========================================");

    // ==========================================
    // CHECK FOR DUPLICATE DOCUMENT
    // ==========================================

    const existingDocument = await Document.findOne({
      fileHash,
    });

    if (existingDocument) {
      console.log("==========================================");
      console.log("DUPLICATE DOCUMENT DETECTED");
      console.log("==========================================");
      console.log("Existing document:", existingDocument._id);
      console.log("File hash:", fileHash);
      console.log("==========================================");

      // ------------------------------------------
      // DELETE NEWLY UPLOADED FILE
      // ------------------------------------------

      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);

          console.log("Duplicate uploaded file deleted");
        }
      } catch (fileDeleteError) {
        console.error(
          "Failed to delete duplicate uploaded file:",
          fileDeleteError,
        );
      }

      // ------------------------------------------
      // RETURN EXISTING DOCUMENT
      // ------------------------------------------

      return res.status(409).json({
        success: false,

        duplicate: true,

        message: "This document has already been uploaded.",

        document: {
          id: existingDocument._id,
          title: existingDocument.title,
          type: existingDocument.type,
          source: existingDocument.source,
          status: existingDocument.status,
          uploadedBy: existingDocument.uploadedBy,
          fileHash: existingDocument.fileHash,
          createdAt: existingDocument.createdAt,
          updatedAt: existingDocument.updatedAt,
        },
      });
    }

    // ==========================================
    // DETERMINE FILE TYPE
    // ==========================================

    const extension = req.file.originalname.split(".").pop().toLowerCase();

    let documentType;

    if (extension === "pdf") {
      documentType = "pdf";
    } else if (extension === "docx") {
      documentType = "docx";
    } else if (extension === "txt") {
      documentType = "txt";
    } else {
      // Delete unsupported uploaded file
      try {
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (fileDeleteError) {
        console.error("Failed to delete unsupported file:", fileDeleteError);
      }

      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${extension}`,
      });
    }

    // ==========================================
    // CREATE DOCUMENT
    // ==========================================

    try {
      document = await Document.create({
        title: req.file.originalname,

        type: documentType,

        source: "upload",

        status: "processing",

        uploadedBy: req.user?._id || null,

        // IMPORTANT
        fileHash,

        metadata: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          mimetype: req.file.mimetype,
          size: req.file.size || 0,
        },
      });
    } catch (createError) {
      // ==========================================
      // HANDLE MONGODB DUPLICATE KEY
      // ==========================================

      if (createError.code === 11000) {
        console.log("Duplicate detected by MongoDB unique index.");

        const duplicateDocument = await Document.findOne({
          fileHash,
        });

        // Delete newly uploaded file
        try {
          if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (fileDeleteError) {
          console.error("Failed to delete duplicate file:", fileDeleteError);
        }

        return res.status(409).json({
          success: false,

          duplicate: true,

          message: "This document has already been uploaded.",

          document: duplicateDocument
            ? {
                id: duplicateDocument._id,
                title: duplicateDocument.title,
                type: duplicateDocument.type,
                source: duplicateDocument.source,
                status: duplicateDocument.status,
                uploadedBy: duplicateDocument.uploadedBy,
                fileHash: duplicateDocument.fileHash,
                createdAt: duplicateDocument.createdAt,
                updatedAt: duplicateDocument.updatedAt,
              }
            : null,
        });
      }

      throw createError;
    }

    console.log("Document created:", document._id.toString());

    console.log("Document fileHash:", document.fileHash);

    // ==========================================
    // EXTRACT TEXT
    // ==========================================

    console.log("==========================================");
    console.log("STARTING TEXT EXTRACTION");
    console.log("==========================================");

    const extractedText = await extractionService.extractTextFromFile(req.file);

    if (!extractedText || !extractedText.trim()) {
      document.status = "failed";

      document.metadata = {
        ...document.metadata,

        error: "No text could be extracted from the document",
      };

      await document.save();

      return res.status(400).json({
        success: false,

        message: "No text could be extracted from the document",

        documentId: document._id,

        fileHash: document.fileHash,
      });
    }

    console.log("Extracted characters:", extractedText.length);

    // ==========================================
    // CLEAN TEXT
    // ==========================================

    console.log("==========================================");
    console.log("CLEANING TEXT");
    console.log("==========================================");

    const cleanedText = chunkService.cleanText(extractedText);

    if (!cleanedText) {
      document.status = "failed";

      document.metadata = {
        ...document.metadata,

        error: "Document text became empty after cleaning",
      };

      await document.save();

      return res.status(400).json({
        success: false,

        message: "Document text became empty after cleaning",

        documentId: document._id,

        fileHash: document.fileHash,
      });
    }

    console.log("Cleaned characters:", cleanedText.length);

    // ==========================================
    // SAVE RAW CONTENT
    // ==========================================

    document.rawContent = cleanedText;

    await document.save();

    console.log("Raw content saved");

    // ==========================================
    // CREATE CHUNKS
    // ==========================================

    console.log("==========================================");
    console.log("CREATING DOCUMENT CHUNKS");
    console.log("==========================================");

    const chunks = await chunkService.createDocumentChunks(
      document._id,
      cleanedText,
      {
        chunkSize: 1000,
        overlap: 150,
      },
    );

    console.log("Chunks created:", chunks.length);

    if (!chunks.length) {
      document.status = "failed";

      document.metadata = {
        ...document.metadata,

        error: "No chunks could be created from the document",
      };

      await document.save();

      return res.status(400).json({
        success: false,

        message: "No chunks could be created from the document",

        documentId: document._id,

        fileHash: document.fileHash,
      });
    }

    // ==========================================
    // GENERATE EMBEDDINGS
    // ==========================================

    console.log("==========================================");
    console.log("GENERATING EMBEDDINGS");
    console.log("==========================================");

    const embeddingResult = await embeddingService.embedDocumentChunks(
      document._id,
    );

    console.log("Embedding result:", embeddingResult);

    // ==========================================
    // RELOAD CHUNKS AFTER EMBEDDINGS
    // ==========================================

    const embeddedChunks = await Chunk.find({
      document: document._id,
    }).sort({
      chunkIndex: 1,
    });

    console.log("Embedded chunks loaded:", embeddedChunks.length);

    console.log(
      "First chunk embedding dimensions:",
      embeddedChunks[0]?.embedding?.length || 0,
    );

    // ==========================================
    // UPDATE DOCUMENT STATUS
    // ==========================================

    document.status = "processed";

    document.metadata = {
      ...document.metadata,

      extractedCharacters: cleanedText.length,

      chunkCount: chunks.length,

      embeddingModel: embeddingResult.embeddingModel,

      embeddedChunks: embeddingResult.processedChunks,

      processedAt: new Date(),
    };

    await document.save();

    console.log("==========================================");
    console.log("DOCUMENT PROCESSING COMPLETED");
    console.log("==========================================");

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({
      success: true,

      message: "Document extracted, chunked, and embedded successfully",

      document: {
        id: document._id,

        title: document.title,

        type: document.type,

        source: document.source,

        status: document.status,

        uploadedBy: document.uploadedBy,

        // IMPORTANT
        fileHash: document.fileHash,

        createdAt: document.createdAt,

        updatedAt: document.updatedAt,
      },

      text: cleanedText,

      chunkCount: chunks.length,

      embedding: {
        model: embeddingResult.embeddingModel,

        totalChunks: chunks.length,

        processedChunks: embeddingResult.processedChunks,
      },

      chunks: embeddedChunks.map((chunk) => ({
        id: chunk._id,

        chunkIndex: chunk.chunkIndex,

        content: chunk.content,

        startChar: chunk.startChar,

        endChar: chunk.endChar,

        embeddingDimensions: chunk.embedding?.length || 0,
      })),
    });
  } catch (error) {
    // ==========================================
    // ERROR HANDLING
    // ==========================================

    console.error("==========================================");

    console.error("DOCUMENT PROCESSING ERROR");

    console.error("==========================================");

    console.error(error);

    // ==========================================
    // MARK DOCUMENT AS FAILED
    // ==========================================

    if (document) {
      try {
        document.status = "failed";

        document.metadata = {
          ...document.metadata,

          error: error.message,

          failedAt: new Date(),
        };

        await document.save();
      } catch (saveError) {
        console.error("Failed to update document:", saveError);
      }
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(500).json({
      success: false,

      message: error.message,

      documentId: document?._id || null,

      fileHash: document?.fileHash || null,
    });
  }
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
  extractDocumentText,
};
