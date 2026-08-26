const Chunk = require("../models/chunk.model");
const embeddingService = require("./embedding.service");

// ======================================================
// CONFIGURATION
// ======================================================

const VECTOR_INDEX_NAME = "vector_index";

// Number of chunks to retrieve
const DEFAULT_LIMIT = 5;

// ======================================================
// VECTOR SEARCH
// ======================================================

const searchSimilarChunks = async (query, options = {}) => {
  try {
    // ================================================
    // VALIDATE QUERY
    // ================================================

    if (!query || !query.trim()) {
      throw new Error("Search query is required");
    }

    const limit = options.limit || DEFAULT_LIMIT;

    const documentId = options.documentId || null;

    console.log("==========================================");

    console.log("VECTOR SEARCH");

    console.log("==========================================");

    console.log("Query:", query);

    console.log("Limit:", limit);

    // ================================================
    // CREATE QUERY EMBEDDING
    // ================================================

    console.log("Creating query embedding...");

    const queryEmbedding = await embeddingService.createQueryEmbedding(query);

    console.log("Query embedding dimensions:", queryEmbedding.length);

    // ================================================
    // BUILD VECTOR SEARCH
    // ================================================

    const vectorSearchStage = {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,

        path: "embedding",

        queryVector: queryEmbedding,

        numCandidates: Math.max(limit * 10, 50),

        limit,
      },
    };

    // ================================================
    // ADD DOCUMENT FILTER IF PROVIDED
    // ================================================

    if (documentId) {
      vectorSearchStage.$vectorSearch.filter = {
        document: typeof documentId === "string" ? documentId : documentId,
      };
    }

    // ================================================
    // EXECUTE SEARCH
    // ================================================

    const results = await Chunk.aggregate([
      vectorSearchStage,

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

    console.log("Search results:", results.length);

    // ================================================
    // LOG RESULTS
    // ================================================

    results.forEach((result, index) => {
      console.log(`Result ${index + 1}:`);

      console.log("Score:", result.score);

      console.log("Chunk:", result.chunkIndex);

      console.log("Content:", result.content);
    });

    console.log("==========================================");

    return {
      query,

      queryEmbeddingDimensions: queryEmbedding.length,

      count: results.length,

      results,
    };
  } catch (error) {
    console.error("==========================================");

    console.error("VECTOR SEARCH ERROR");

    console.error("==========================================");

    console.error(error);

    throw new Error(`Vector search failed: ${error.message}`);
  }
};

// ======================================================
// SEARCH DOCUMENT
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
