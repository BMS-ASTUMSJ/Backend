const retrievalService = require("./retrieval.service");
const llmService = require("./llm.service");

// ======================================================
// BUILD RAG CONTEXT
// ======================================================

const buildContext = async (query, options = {}) => {
  if (!query || !query.trim()) {
    throw new Error("Query is required");
  }

  // ====================================================
  // OPTIONS
  // ====================================================

  const limit =
    Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
      ? Number(options.limit)
      : 5;

  const minScore =
    options.minScore !== undefined &&
    options.minScore !== null &&
    options.minScore !== ""
      ? Number(options.minScore)
      : 0;

  // ====================================================
  // RETRIEVE MORE RESULTS
  // ====================================================
  // We retrieve more than the requested limit because
  // some results may be duplicates.
  //
  // Example:
  //
  // Requested: 5
  //
  // Vector search:
  // 1. rag.pdf
  // 2. rag.pdf
  // 3. rag.pdf
  // 4. another.pdf
  // 5. policy.pdf
  //
  // After deduplication:
  // 1. rag.pdf
  // 2. another.pdf
  // 3. policy.pdf
  //
  // ====================================================

  const searchLimit = Math.max(limit * 3, limit);

  const searchResult = await retrievalService.searchSimilarChunks(query, {
    limit: searchLimit,

    documentId: options.documentId || null,
  });

  // ====================================================
  // SCORE FILTER
  // ====================================================

  const filteredResults = (searchResult.results || []).filter((result) => {
    const score = Number(result.score);

    return Number.isFinite(score) && score >= minScore;
  });

  // ====================================================
  // REMOVE DUPLICATES
  // ====================================================
  //
  // A duplicate is considered the same when:
  //
  // 1. It belongs to the same document
  // 2. It contains the same chunk content
  //
  // This is safer than deduplicating only by document ID,
  // because one document can legitimately contain multiple
  // different chunks.
  //
  // ====================================================

  const seenChunks = new Set();

  const uniqueResults = [];

  for (const result of filteredResults) {
    const documentId = String(result.document || "");

    const content = String(result.content || "")
      .trim()
      .replace(/\s+/g, " ");

    const duplicateKey = `${documentId}::${content}`;

    if (seenChunks.has(duplicateKey)) {
      console.log("Duplicate RAG chunk skipped:", result._id);

      continue;
    }

    seenChunks.add(duplicateKey);

    uniqueResults.push(result);

    // Stop after we have enough unique results
    if (uniqueResults.length >= limit) {
      break;
    }
  }

  // ====================================================
  // BUILD CONTEXT
  // ====================================================

  const context = uniqueResults
    .map((result, index) => `[Source ${index + 1}]\n${result.content}`)
    .join("\n\n");

  // ====================================================
  // SOURCES
  // ====================================================

  const sources = uniqueResults.map((result, index) => ({
    sourceNumber: index + 1,

    documentId: result.document,

    chunkId: result._id,

    chunkIndex: result.chunkIndex,

    score: result.score,
  }));

  // ====================================================
  // LOGGING
  // ====================================================

  console.log("==========================================");
  console.log("RAG CONTEXT");
  console.log("==========================================");

  console.log("Query:", query);

  console.log("Vector search results:", searchResult.results?.length || 0);

  console.log("After score filtering:", filteredResults.length);

  console.log("After deduplication:", uniqueResults.length);

  console.log(
    "Query embedding dimensions:",
    searchResult.queryEmbeddingDimensions,
  );

  console.log("==========================================");

  // ====================================================
  // RETURN
  // ====================================================

  return {
    query,

    context,

    sources,

    retrievedChunks: uniqueResults.length,

    queryEmbeddingDimensions: searchResult.queryEmbeddingDimensions,
  };
};

// ======================================================
// GENERATE RAG ANSWER
// ======================================================

const answerQuestion = async (query, options = {}) => {
  // ====================================================
  // BUILD CONTEXT
  // ====================================================

  const ragContext = await buildContext(query, options);

  // ====================================================
  // NO RELEVANT INFORMATION
  // ====================================================

  if (!ragContext.context || !ragContext.context.trim()) {
    return {
      query,

      answer:
        "I could not find relevant information in the provided documents.",

      context: "",

      sources: [],

      retrievedChunks: 0,

      queryEmbeddingDimensions: ragContext.queryEmbeddingDimensions,

      model: null,
    };
  }

  // ====================================================
  // GENERATE ANSWER
  // ====================================================

  const llmResult = await llmService.generateRagAnswer({
    question: query,

    context: ragContext.context,
  });

  // ====================================================
  // RETURN
  // ====================================================

  return {
    query,

    answer: llmResult.answer,

    context: ragContext.context,

    sources: ragContext.sources,

    retrievedChunks: ragContext.retrievedChunks,

    queryEmbeddingDimensions: ragContext.queryEmbeddingDimensions,

    model: llmResult.model,
  };
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  buildContext,
  answerQuestion,
};
