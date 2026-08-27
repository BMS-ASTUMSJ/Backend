const mongoose = require("mongoose");

const Chunk = require("../models/chunk.model");
const embeddingService = require("./embedding.service");

// ======================================================
// CONFIGURATION
// ======================================================

const VECTOR_INDEX_NAME = "vector_index";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

// ======================================================
// NORMALIZE LIMIT
// ======================================================

const normalizeLimit = (value) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

// ======================================================
// NORMALIZE DOCUMENT ID
// ======================================================

const normalizeDocumentId = (documentId) => {
  if (!documentId) {
    return null;
  }

  if (documentId instanceof mongoose.Types.ObjectId) {
    return documentId;
  }

  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    const error = new Error("Invalid document ID");
    error.statusCode = 400;
    throw error;
  }

  return new mongoose.Types.ObjectId(documentId);
};

// ======================================================
// VECTOR SEARCH
// ======================================================

const searchSimilarChunks = async (query, options = {}) => {
  try {
    // ==================================================
    // VALIDATE QUERY
    // ==================================================

    if (!query || !String(query).trim()) {
      const error = new Error("Search query is required");
      error.statusCode = 400;
      throw error;
    }

    const cleanQuery = String(query).trim();

    const limit = normalizeLimit(options.limit);

    const documentId = normalizeDocumentId(options.documentId);

    // ==================================================
    // LOG
    // ==================================================

    console.log("==========================================");
    console.log("VECTOR SEARCH");
    console.log("==========================================");

    console.log("Query:", cleanQuery);
    console.log("Limit:", limit);
    console.log("Document ID:", documentId || "ALL DOCUMENTS");

    // ==================================================
    // CREATE QUERY EMBEDDING
    // ==================================================

    console.log("Creating query embedding...");

    const queryEmbedding =
      await embeddingService.createQueryEmbedding(cleanQuery);

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error("Failed to create query embedding");
    }

    console.log("Query embedding dimensions:", queryEmbedding.length);

    // ==================================================
    // VECTOR SEARCH
    // ==================================================

    const vectorSearch = {
      index: VECTOR_INDEX_NAME,

      path: "embedding",

      queryVector: queryEmbedding,

      numCandidates: Math.max(limit * 20, 100),

      limit,
    };

    // ==================================================
    // DOCUMENT FILTER
    // ==================================================

    if (documentId) {
      vectorSearch.filter = {
        document: documentId,
      };
    }

    // ==================================================
    // AGGREGATION
    // ==================================================

    const results = await Chunk.aggregate([
      {
        $vectorSearch: vectorSearch,
      },

      {
        $addFields: {
          score: {
            $meta: "vectorSearchScore",
          },
        },
      },

      {
        $project: {
          _id: 1,

          document: 1,

          content: 1,

          chunkIndex: 1,

          startChar: 1,

          endChar: 1,

          score: 1,
        },
      },

      {
        $sort: {
          score: -1,
        },
      },
    ]);

    // ==================================================
    // LOG RESULTS
    // ==================================================

    console.log("Search results:", results.length);

    results.forEach((result, index) => {
      console.log(
        `Result ${index + 1}: score=${result.score}, chunk=${result.chunkIndex}`,
      );
    });

    console.log("==========================================");

    return {
      query: cleanQuery,

      queryEmbeddingDimensions: queryEmbedding.length,

      count: results.length,

      results,
    };
  } catch (error) {
    console.error("==========================================");
    console.error("VECTOR SEARCH ERROR");
    console.error("==========================================");
    console.error(error);
    console.error("==========================================");

    if (error.statusCode) {
      throw error;
    }

    const wrappedError = new Error(`Vector search failed: ${error.message}`);

    wrappedError.statusCode = 500;

    throw wrappedError;
  }
};

// ======================================================
// SEARCH SINGLE DOCUMENT
// ======================================================

const searchDocument = async (documentId, query, limit = DEFAULT_LIMIT) => {
  return searchSimilarChunks(query, {
    documentId,
    limit,
  });
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  searchSimilarChunks,
  searchDocument,
};
