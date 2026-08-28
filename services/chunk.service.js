const Chunk = require("../models/chunk.model");

/**
 * Clean extracted document text.
 */
const cleanText = (text) => {
  if (!text) {
    return "";
  }

  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const splitTextIntoChunks = (text, chunkSize = 1000, overlap = 150) => {
  const cleanedText = cleanText(text);

  if (!cleanedText) {
    return [];
  }

  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }

  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error(
      "overlap must be greater than or equal to 0 and smaller than chunkSize",
    );
  }

  const chunks = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < cleanedText.length) {
    let end = Math.min(start + chunkSize, cleanedText.length);

    if (end < cleanedText.length) {
      const paragraphBreak = cleanedText.lastIndexOf("\n\n", end);

      const sentenceBreak = Math.max(
        cleanedText.lastIndexOf(". ", end),
        cleanedText.lastIndexOf("? ", end),
        cleanedText.lastIndexOf("! ", end),
      );

      const lineBreak = cleanedText.lastIndexOf("\n", end);

      if (paragraphBreak > start + chunkSize * 0.5) {
        end = paragraphBreak;
      } else if (sentenceBreak > start + chunkSize * 0.5) {
        end = sentenceBreak + 1;
      } else if (lineBreak > start + chunkSize * 0.5) {
        end = lineBreak;
      }
    }

    const content = cleanedText.slice(start, end).trim();

    if (content) {
      chunks.push({
        content,
        chunkIndex,
        startChar: start,
        endChar: end,
      });

      chunkIndex++;
    }

    if (end >= cleanedText.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

/**
 * Delete all existing chunks for a document.
 */
const deleteDocumentChunks = async (documentId) => {
  return Chunk.deleteMany({
    document: documentId,
  });
};

/**
 * Create and save chunks for a document.
 */
const createDocumentChunks = async (documentId, text, options = {}) => {
  const { chunkSize = 1000, overlap = 150 } = options;

  const chunks = splitTextIntoChunks(text, chunkSize, overlap);

  if (chunks.length === 0) {
    return [];
  }

  await deleteDocumentChunks(documentId);

  const documents = chunks.map((chunk) => ({
    document: documentId,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    startChar: chunk.startChar,
    endChar: chunk.endChar,
    embedding: [],
  }));

  const savedChunks = await Chunk.insertMany(documents);

  return savedChunks;
};

module.exports = {
  cleanText,
  splitTextIntoChunks,
  createDocumentChunks,
  deleteDocumentChunks,
};
