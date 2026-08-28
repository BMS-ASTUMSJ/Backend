const ragService = require("../services/rag.service");

const getRagContext = async (req, res) => {
  try {
    const { question, query, limit, minScore, documentId } = req.body;

    const userQuery = question || query;

    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    const retrievalLimit = Number(limit) || 5;

    const minimumScore = minScore !== undefined ? Number(minScore) : 0;

    const result = await ragService.buildContext(userQuery.trim(), {
      limit: retrievalLimit,

      minScore: minimumScore,

      documentId: documentId || null,
    });

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

const askRagQuestion = async (req, res) => {
  try {
    const { question, query, limit, minScore, documentId } = req.body;

    const userQuestion = question || query;

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

    const retrievalLimit = Number(limit) || 5;

    const minimumScore = minScore !== undefined ? Number(minScore) : 0.5;

    const result = await ragService.answerQuestion(userQuestion.trim(), {
      limit: retrievalLimit,

      minScore: minimumScore,

      documentId: documentId || null,
    });

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

module.exports = {
  getRagContext,
  askRagQuestion,
};
