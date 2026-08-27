const retrievalService = require("./retrieval.service");
const llmService = require("./llm.service");

// ======================================================
// CONFIGURATION
// ======================================================

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

// ======================================================
// OUT OF SCOPE MESSAGE
// ======================================================

const OUT_OF_SCOPE_MESSAGE =
  "I don't have information about that. I am only the ASTU MSJ Summer Bootcamp Assistant.";

// ======================================================
// IMPORTANT
// ======================================================
//
// MongoDB Atlas vector search scores can vary depending on
// the embedding model and similarity configuration.
//
// 0.7 was too strict for your current setup.
//
// Start with 0.30 and test the actual scores in your
// backend console.
//
// ======================================================

const DEFAULT_MIN_SCORE = 0.3;

// ======================================================
// NORMALIZE OPTIONS
// ======================================================

const normalizeOptions = (options = {}) => {
  const parsedLimit = Number(options.limit);

  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const parsedMinScore = Number(options.minScore);

  const minScore =
    Number.isFinite(parsedMinScore) && parsedMinScore >= 0
      ? parsedMinScore
      : DEFAULT_MIN_SCORE;

  return {
    limit,
    minScore,
    documentId: options.documentId || null,
  };
};

// ======================================================
// BUILD RAG CONTEXT
// ======================================================

const buildContext = async (query, options = {}) => {
  if (!query || !String(query).trim()) {
    throw new Error("Query is required");
  }

  const cleanQuery = String(query).trim();

  const { limit, minScore, documentId } = normalizeOptions(options);

  // ====================================================
  // RETRIEVE MORE RESULTS THAN WE FINALLY USE
  // ====================================================

  const searchLimit = Math.min(Math.max(limit * 4, limit), MAX_LIMIT);

  console.log("==========================================");
  console.log("BUILDING RAG CONTEXT");
  console.log("==========================================");
  console.log("Question:", cleanQuery);
  console.log("Search limit:", searchLimit);
  console.log("Final context limit:", limit);
  console.log("Minimum score:", minScore);
  console.log("Document:", documentId || "ALL PROCESSED DOCUMENTS");

  // ====================================================
  // VECTOR SEARCH
  // ====================================================

  const searchResult = await retrievalService.searchSimilarChunks(cleanQuery, {
    limit: searchLimit,
    documentId,
  });

  const rawResults = Array.isArray(searchResult.results)
    ? searchResult.results
    : [];

  console.log("==========================================");
  console.log("RAW VECTOR SEARCH RESULTS");
  console.log("==========================================");
  console.log("Total results:", rawResults.length);

  rawResults.forEach((result, index) => {
    console.log(
      `#${index + 1}`,
      "score:",
      Number(result.score),
      "chunk:",
      result.chunkIndex,
      "document:",
      result.document,
    );

    console.log(
      "content preview:",
      String(result.content || "")
        .replace(/\s+/g, " ")
        .substring(0, 200),
    );
  });

  // ====================================================
  // FILTER RESULTS
  // ====================================================

  const filteredResults = rawResults.filter((result) => {
    const score = Number(result.score);

    return (
      Number.isFinite(score) &&
      score >= minScore &&
      String(result.content || "").trim().length > 0
    );
  });

  console.log("==========================================");
  console.log("FILTERED RESULTS");
  console.log("==========================================");
  console.log("Relevant results:", filteredResults.length);

  // ====================================================
  // REMOVE DUPLICATES
  // ====================================================

  const seenChunks = new Set();

  const uniqueResults = [];

  for (const result of filteredResults) {
    const documentKey = String(result.document || "");

    const contentKey = String(result.content || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    const duplicateKey = `${documentKey}::${contentKey}`;

    if (seenChunks.has(duplicateKey)) {
      continue;
    }

    seenChunks.add(duplicateKey);

    uniqueResults.push(result);

    if (uniqueResults.length >= limit) {
      break;
    }
  }

  // ====================================================
  // BUILD CONTEXT
  // ====================================================

  const context = uniqueResults
    .map((result, index) => {
      const content = String(result.content || "").trim();

      if (!content) {
        return "";
      }

      return [
        `[Source ${index + 1}]`,
        `Document ID: ${result.document || "unknown"}`,
        `Chunk: ${result.chunkIndex ?? "unknown"}`,
        content,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  // ====================================================
  // SOURCES
  // ====================================================

  const sources = uniqueResults.map((result, index) => ({
    sourceNumber: index + 1,

    documentId: result.document,

    chunkId: result._id,

    chunkIndex: result.chunkIndex,

    score: Number(result.score),
  }));

  // ====================================================
  // BEST SCORE
  // ====================================================

  const bestScore =
    rawResults.length > 0
      ? Math.max(
          ...rawResults
            .map((result) => Number(result.score))
            .filter(Number.isFinite),
        )
      : 0;

  // ====================================================
  // FINAL DEBUG
  // ====================================================

  console.log("==========================================");
  console.log("RAG CONTEXT RESULT");
  console.log("==========================================");
  console.log("Question:", cleanQuery);
  console.log("Raw results:", rawResults.length);
  console.log("Filtered results:", filteredResults.length);
  console.log("Unique results:", uniqueResults.length);
  console.log("Best score:", bestScore);
  console.log("Required score:", minScore);
  console.log("Has context:", Boolean(context.trim()));
  console.log("==========================================");

  return {
    query: cleanQuery,

    context,

    sources,

    retrievedChunks: uniqueResults.length,

    queryEmbeddingDimensions: searchResult.queryEmbeddingDimensions || 0,

    bestScore,

    minScore,

    results: uniqueResults,

    rawResults,
  };
};

// ======================================================
// CHECK RELEVANCE
// ======================================================

const hasRelevantContext = (ragContext) => {
  if (!ragContext) {
    return false;
  }

  if (!ragContext.context || !String(ragContext.context).trim()) {
    return false;
  }

  if (!Array.isArray(ragContext.sources) || ragContext.sources.length === 0) {
    return false;
  }

  const bestScore = Number(ragContext.bestScore);

  const minScore = Number(ragContext.minScore);

  if (!Number.isFinite(bestScore)) {
    return false;
  }

  if (!Number.isFinite(minScore)) {
    return false;
  }

  return bestScore >= minScore;
};

// ======================================================
// ANSWER QUESTION
// ======================================================

const answerQuestion = async (query, options = {}) => {
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) {
    throw new Error("Question is required");
  }

  // ====================================================
  // BUILD CONTEXT
  // ====================================================

  const ragContext = await buildContext(cleanQuery, options);

  // ====================================================
  // CHECK RELEVANCE
  // ====================================================

  if (!hasRelevantContext(ragContext)) {
    console.log("==========================================");
    console.log("RAG: QUESTION OUT OF SCOPE");
    console.log("==========================================");
    console.log("Question:", cleanQuery);
    console.log("Best score:", ragContext.bestScore);
    console.log("Required:", ragContext.minScore);
    console.log("Retrieved chunks:", ragContext.retrievedChunks);
    console.log("==========================================");

    return {
      query: cleanQuery,

      answer: OUT_OF_SCOPE_MESSAGE,

      context: "",

      sources: [],

      retrievedChunks: 0,

      queryEmbeddingDimensions: ragContext.queryEmbeddingDimensions || 0,

      model: null,

      outOfScope: true,

      bestScore: ragContext.bestScore || 0,

      minScore: ragContext.minScore,
    };
  }

  // ====================================================
  // SEND DOCUMENT CONTEXT TO GEMINI
  // ====================================================

  console.log("==========================================");
  console.log("SENDING DOCUMENT CONTEXT TO GEMINI");
  console.log("==========================================");

  console.log("Context length:", ragContext.context.length);

  console.log("Sources:", ragContext.sources.length);

  // ====================================================
  // GENERATE ANSWER
  // ====================================================

  const llmResult = await llmService.generateRagAnswer({
    question: cleanQuery,

    context: ragContext.context,
  });

  // ====================================================
  // SAFETY FALLBACK
  // ====================================================

  const answer =
    llmResult && llmResult.answer && String(llmResult.answer).trim()
      ? String(llmResult.answer).trim()
      : OUT_OF_SCOPE_MESSAGE;

  // ====================================================
  // RETURN
  // ====================================================

  return {
    query: cleanQuery,

    answer,

    context: ragContext.context,

    sources: ragContext.sources,

    retrievedChunks: ragContext.retrievedChunks,

    queryEmbeddingDimensions: ragContext.queryEmbeddingDimensions,

    model: llmResult?.model || null,

    outOfScope: false,

    bestScore: ragContext.bestScore,

    minScore: ragContext.minScore,
  };
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  buildContext,
  answerQuestion,
  hasRelevantContext,
  OUT_OF_SCOPE_MESSAGE,
};
