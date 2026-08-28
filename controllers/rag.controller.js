const ragService = require("../services/rag.service");

// ======================================================
// GET RAG CONTEXT
// ======================================================

const getRagContext = async (req, res) => {
  try {
    // Accept both names for compatibility
    const { question, query, limit, minScore, documentId } = req.body;

    const userQuery = question || query;

    // ==================================================
    // VALIDATE QUERY
    // ==================================================

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    // ==================================================
    // OPTIONS
    // ==================================================

    const retrievalLimit = Number(limit) || 5;

    const minimumScore = minScore !== undefined ? Number(minScore) : 0;

    // ==================================================
    // BUILD RAG CONTEXT
    // ==================================================

    const result = await ragService.buildContext(userQuery.trim(), {
      limit: retrievalLimit,

      minScore: minimumScore,

      documentId: documentId || null,
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "RAG context created successfully",

      question: result.query,

      retrievedChunks: result.retrievedChunks,

      queryEmbeddingDimensions: result.queryEmbeddingDimensions,

      context: result.context,

      sources: result.sources,
    });
  } catch (error) {
    console.error("==========================================");
    console.error("RAG CONTEXT ERROR");
    console.error("==========================================");
    console.error(error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to create RAG context",
    });
  }
};

// ======================================================
// ASK RAG QUESTION
// ======================================================

const askRagQuestion = async (req, res) => {
  try {
    // Accept both "question" and old "query"
    const { question, query, limit, minScore, documentId } = req.body;

    const userQuestion = question || query;

    // ==================================================
    // VALIDATE
    // ==================================================

    if (!userQuestion || !userQuestion.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    console.log("==========================================");
    console.log("RAG QUESTION");
    console.log("==========================================");

    console.log("Question:", userQuestion);

    // ==================================================
    // RAG OPTIONS
    // ==================================================

    const retrievalLimit = Number(limit) || 5;

    const minimumScore = minScore !== undefined ? Number(minScore) : 0.5;

    // ==================================================
    // COMPLETE RAG PIPELINE
    // ==================================================

    const result = await ragService.answerQuestion(userQuestion.trim(), {
      limit: retrievalLimit,

      minScore: minimumScore,

      documentId: documentId || null,
    });

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message: "RAG answer generated successfully",

      question: result.query,

      answer: result.answer,

      model: result.model,

      retrievedChunks: result.retrievedChunks,

      queryEmbeddingDimensions: result.queryEmbeddingDimensions,

      sources: result.sources,
    });
  } catch (error) {
    console.error("==========================================");
    console.error("RAG ANSWER ERROR");
    console.error("==========================================");

    console.error(error);

    return res.status(500).json({
      success: false,

      message: error.message || "Failed to generate RAG answer",
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  getRagContext,
  askRagQuestion,
};
