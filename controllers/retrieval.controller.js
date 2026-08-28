const retrievalService = require("../services/retrieval.service");

// ======================================================
// SEARCH DOCUMENTS
// ======================================================

const searchDocuments = async (req, res) => {
  try {
    const { query, limit, documentId } = req.body;

    // ================================================
    // VALIDATE QUERY
    // ================================================

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    // ================================================
    // SEARCH
    // ================================================

    const result = await retrievalService.searchSimilarChunks(query, {
      limit: Number(limit) || 5,

      documentId: documentId || null,
    });

    // ================================================
    // RESPONSE
    // ================================================

    return res.status(200).json({
      success: true,

      message: "Vector search completed successfully",

      query: result.query,

      queryEmbeddingDimensions: result.queryEmbeddingDimensions,

      count: result.count,

      results: result.results.map((chunk) => ({
        id: chunk._id,

        document: chunk.document,

        chunkIndex: chunk.chunkIndex,

        content: chunk.content,

        startChar: chunk.startChar,

        endChar: chunk.endChar,

        score: chunk.score,
      })),
    });
  } catch (error) {
    console.error("Retrieval controller error:", error);

    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

module.exports = {
  searchDocuments,
};
