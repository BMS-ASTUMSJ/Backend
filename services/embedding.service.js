const axios = require("axios");
const Chunk = require("../models/chunk.model");

// ======================================================
// VOYAGE AI CONFIGURATION
// ======================================================

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const VOYAGE_EMBEDDING_URL = "https://api.voyageai.com/v1/embeddings";

const EMBEDDING_MODEL = "voyage-4-lite";

// ======================================================
// CREATE EMBEDDING
// ======================================================

const createEmbedding = async (text, inputType = "document") => {
  if (!text || !text.trim()) {
    throw new Error("Cannot create embedding from empty text");
  }

  if (!VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not configured in .env");
  }

  try {
    console.log(`Creating Voyage embedding using ${EMBEDDING_MODEL}...`);

    const response = await axios.post(
      VOYAGE_EMBEDDING_URL,
      {
        input: [text],

        model: EMBEDDING_MODEL,

        input_type: inputType,
      },
      {
        headers: {
          Authorization: `Bearer ${VOYAGE_API_KEY}`,
          "Content-Type": "application/json",
        },

        timeout: 60000,
      },
    );

    // ==================================================
    // CHECK RESPONSE
    // ==================================================

    if (
      !response.data ||
      !response.data.data ||
      !response.data.data[0] ||
      !response.data.data[0].embedding
    ) {
      console.error("Invalid Voyage response:", response.data);

      throw new Error("Voyage AI returned an invalid embedding response");
    }

    const embedding = response.data.data[0].embedding;

    console.log(
      `Embedding created successfully (${embedding.length} dimensions)`,
    );

    return embedding;
  } catch (error) {
    console.error("==========================================");

    console.error("VOYAGE EMBEDDING ERROR");

    console.error("==========================================");

    // ================================================
    // VOYAGE API ERROR
    // ================================================

    if (error.response) {
      console.error("Status:", error.response.status);

      console.error("Response:", error.response.data);

      const message =
        error.response.data?.detail ||
        error.response.data?.message ||
        "Unknown Voyage AI error";

      throw new Error(`Voyage AI error ${error.response.status}: ${message}`);
    }

    // ================================================
    // NETWORK / OTHER ERROR
    // ================================================

    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

// ======================================================
// EMBED ALL CHUNKS FOR A DOCUMENT
// ======================================================

const embedDocumentChunks = async (documentId) => {
  if (!documentId) {
    throw new Error("Document ID is required");
  }

  // ================================================
  // FIND DOCUMENT CHUNKS
  // ================================================

  const chunks = await Chunk.find({
    document: documentId,
  }).sort({
    chunkIndex: 1,
  });

  if (!chunks.length) {
    throw new Error("No chunks found for this document");
  }

  console.log("==========================================");

  console.log(`Generating embeddings for ${chunks.length} chunks`);

  console.log("==========================================");

  let processed = 0;

  let dimensions = 0;

  // ================================================
  // PROCESS EACH CHUNK
  // ================================================

  for (const chunk of chunks) {
    console.log(`Embedding chunk ${chunk.chunkIndex + 1}/${chunks.length}...`);

    const embedding = await createEmbedding(chunk.content, "document");

    // ==============================================
    // SAVE VECTOR
    // ==============================================

    chunk.embedding = embedding;

    await chunk.save();

    processed++;

    dimensions = embedding.length;

    console.log(`Chunk ${chunk.chunkIndex} embedded successfully`);

    console.log(`Dimensions: ${embedding.length}`);
  }

  console.log("==========================================");

  console.log(`Successfully embedded ${processed} chunks`);

  console.log("==========================================");

  return {
    totalChunks: chunks.length,

    processedChunks: processed,

    embeddingModel: EMBEDDING_MODEL,
  };
};

// ======================================================
// CREATE QUERY EMBEDDING
// ======================================================
// This will be used later for MongoDB Vector Search.
//
// Documents:
// input_type = "document"
//
// User questions:
// input_type = "query"
// ======================================================

const createQueryEmbedding = async (query) => {
  if (!query || !query.trim()) {
    throw new Error("Query cannot be empty");
  }

  return createEmbedding(query, "query");
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createEmbedding,

  createQueryEmbedding,

  embedDocumentChunks,

  EMBEDDING_MODEL,
};
