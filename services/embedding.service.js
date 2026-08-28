const axios = require("axios");
const Chunk = require("../models/chunk.model");

// ======================================================
// VOYAGE AI CONFIGURATION
// ======================================================

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const VOYAGE_EMBEDDING_URL = "https://api.voyageai.com/v1/embeddings";

const EMBEDDING_MODEL = "voyage-4-lite";

// ======================================================
// BATCH / RETRY CONFIGURATION
// ======================================================

// Voyage is currently limiting your account to 3 requests/minute.
// We therefore send many chunks in one request instead of
// making one API request for every chunk.

const EMBEDDING_BATCH_SIZE = 8;

// Maximum number of retries after HTTP 429
const MAX_RETRIES = 5;

// Initial retry delay
const INITIAL_RETRY_DELAY = 22000;

// ======================================================
// SLEEP HELPER
// ======================================================

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ======================================================
// CREATE EMBEDDING FOR ONE TEXT
// ======================================================

const createEmbedding = async (text, inputType = "document") => {
  if (!text || !String(text).trim()) {
    throw new Error("Cannot create embedding from empty text");
  }

  if (!VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not configured in .env");
  }

  const cleanText = String(text).trim();

  console.log(
    `Creating Voyage embedding using ${EMBEDDING_MODEL} (${inputType})...`,
  );

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await axios.post(
        VOYAGE_EMBEDDING_URL,
        {
          input: [cleanText],
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
      // VALIDATE RESPONSE
      // ==================================================

      if (
        !response.data ||
        !Array.isArray(response.data.data) ||
        !response.data.data[0] ||
        !Array.isArray(response.data.data[0].embedding)
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
      const status = error.response?.status;

      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Unknown Voyage AI error";

      // ==================================================
      // RATE LIMIT
      // ==================================================

      if (status === 429) {
        attempt++;

        if (attempt > MAX_RETRIES) {
          console.error("==========================================");
          console.error("VOYAGE RATE LIMIT - MAX RETRIES REACHED");
          console.error("==========================================");

          throw new Error(
            `Voyage AI rate limit exceeded after ${MAX_RETRIES} retries: ${message}`,
          );
        }

        // Exponential backoff
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);

        console.warn("==========================================");
        console.warn("VOYAGE RATE LIMIT (429)");
        console.warn("==========================================");

        console.warn(`Attempt: ${attempt}/${MAX_RETRIES}`);
        console.warn(`Retrying in ${Math.round(delay / 1000)} seconds...`);

        await sleep(delay);

        continue;
      }

      // ==================================================
      // OTHER VOYAGE API ERROR
      // ==================================================

      console.error("==========================================");
      console.error("VOYAGE EMBEDDING ERROR");
      console.error("==========================================");

      if (error.response) {
        console.error("Status:", status);
        console.error("Response:", error.response.data);

        throw new Error(`Voyage AI error ${status}: ${message}`);
      }

      // ==================================================
      // NETWORK ERROR
      // ==================================================

      throw new Error(`Failed to generate embedding: ${message}`);
    }
  }

  throw new Error("Failed to generate embedding");
};

// ======================================================
// CREATE EMBEDDINGS FOR MULTIPLE TEXTS
// ======================================================

const createBatchEmbeddings = async (texts, inputType = "document") => {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error("Texts array is required");
  }

  if (!VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not configured in .env");
  }

  const cleanTexts = texts.map((text, index) => {
    if (!text || !String(text).trim()) {
      throw new Error(`Chunk ${index + 1} contains empty text`);
    }

    return String(text).trim();
  });

  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(
        `Creating ${cleanTexts.length} embeddings in one Voyage request...`,
      );

      const response = await axios.post(
        VOYAGE_EMBEDDING_URL,
        {
          input: cleanTexts,
          model: EMBEDDING_MODEL,
          input_type: inputType,
        },
        {
          headers: {
            Authorization: `Bearer ${VOYAGE_API_KEY}`,
            "Content-Type": "application/json",
          },

          timeout: 120000,
        },
      );

      // ==================================================
      // VALIDATE RESPONSE
      // ==================================================

      if (!response.data || !Array.isArray(response.data.data)) {
        console.error("Invalid Voyage batch response:", response.data);

        throw new Error(
          "Voyage AI returned an invalid batch embedding response",
        );
      }

      const embeddings = response.data.data
        .sort((a, b) => {
          return (a.index ?? 0) - (b.index ?? 0);
        })
        .map((item) => item.embedding);

      if (embeddings.length !== cleanTexts.length) {
        throw new Error(
          `Voyage returned ${embeddings.length} embeddings for ${cleanTexts.length} inputs`,
        );
      }

      for (const embedding of embeddings) {
        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error("Voyage returned an invalid embedding");
        }
      }

      console.log(`Successfully created ${embeddings.length} embeddings`);

      console.log(`Embedding dimensions: ${embeddings[0].length}`);

      return embeddings;
    } catch (error) {
      const status = error.response?.status;

      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Unknown Voyage AI error";

      // ==================================================
      // RATE LIMIT
      // ==================================================

      if (status === 429) {
        attempt++;

        if (attempt > MAX_RETRIES) {
          console.error("==========================================");
          console.error("VOYAGE BATCH RATE LIMIT");
          console.error("==========================================");

          throw new Error(
            `Voyage AI rate limit exceeded after ${MAX_RETRIES} retries: ${message}`,
          );
        }

        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);

        console.warn("==========================================");
        console.warn("VOYAGE BATCH RATE LIMIT (429)");
        console.warn("==========================================");

        console.warn(`Attempt: ${attempt}/${MAX_RETRIES}`);

        console.warn(
          `Retrying batch in ${Math.round(delay / 1000)} seconds...`,
        );

        await sleep(delay);

        continue;
      }

      // ==================================================
      // OTHER API ERROR
      // ==================================================

      console.error("==========================================");
      console.error("VOYAGE BATCH EMBEDDING ERROR");
      console.error("==========================================");

      if (error.response) {
        console.error("Status:", status);
        console.error("Response:", error.response.data);

        throw new Error(`Voyage AI error ${status}: ${message}`);
      }

      throw new Error(`Failed to generate batch embeddings: ${message}`);
    }
  }

  throw new Error("Failed to generate batch embeddings");
};

// ======================================================
// EMBED ALL CHUNKS FOR A DOCUMENT
// ======================================================

const embedDocumentChunks = async (documentId) => {
  if (!documentId) {
    throw new Error("Document ID is required");
  }

  // ==================================================
  // FIND DOCUMENT CHUNKS
  // ==================================================

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

  // ==================================================
  // PROCESS IN BATCHES
  // ==================================================

  for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);

    const batchNumber = Math.floor(start / EMBEDDING_BATCH_SIZE) + 1;

    const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE);

    console.log("==========================================");

    console.log(`Processing embedding batch ${batchNumber}/${totalBatches}`);

    console.log(
      `Chunks ${start + 1}-${start + batch.length} of ${chunks.length}`,
    );

    console.log("==========================================");

    // ==================================================
    // GET TEXTS
    // ==================================================

    const texts = batch.map((chunk) => chunk.content);

    // ==================================================
    // CREATE BATCH EMBEDDINGS
    // ==================================================

    const embeddings = await createBatchEmbeddings(texts, "document");

    // ==================================================
    // SAVE EMBEDDINGS
    // ==================================================

    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];

      const embedding = embeddings[i];

      chunk.embedding = embedding;

      await chunk.save();

      processed++;

      dimensions = embedding.length;

      console.log(`Chunk ${chunk.chunkIndex} embedded successfully`);
    }

    console.log(`Batch ${batchNumber}/${totalBatches} completed`);

    // ==================================================
    // RATE LIMIT PROTECTION
    // ==================================================

    // Your current Voyage account has a 3 RPM limit.
    //
    // Wait before making the next API request.
    //
    // 21 seconds gives us roughly <= 3 requests/minute.

    if (start + EMBEDDING_BATCH_SIZE < chunks.length) {
      console.log(
        "Waiting before next Voyage request to respect rate limit...",
      );

      await sleep(22000);
    }
  }

  // ==================================================
  // COMPLETE
  // ==================================================

  console.log("==========================================");

  console.log(`Successfully embedded ${processed} chunks`);

  console.log(`Embedding dimensions: ${dimensions}`);

  console.log("==========================================");

  return {
    totalChunks: chunks.length,

    processedChunks: processed,

    embeddingModel: EMBEDDING_MODEL,

    dimensions,
  };
};

// ======================================================
// CREATE QUERY EMBEDDING
// ======================================================

const createQueryEmbedding = async (query) => {
  if (!query || !String(query).trim()) {
    throw new Error("Query cannot be empty");
  }

  return createEmbedding(String(query).trim(), "query");
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createEmbedding,

  createBatchEmbeddings,

  createQueryEmbedding,

  embedDocumentChunks,

  EMBEDDING_MODEL,
};
