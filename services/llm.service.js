const { GoogleGenerativeAI } = require("@google/generative-ai");

// ======================================================
// CONFIGURATION
// ======================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-3.6-flash";

// ======================================================
// INITIALIZE GEMINI
// ======================================================

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not configured");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ======================================================
// GENERATE RAG ANSWER
// ======================================================

const generateRagAnswer = async ({ question, context }) => {
  try {
    if (!question || !question.trim()) {
      throw new Error("Question is required");
    }

    if (!context || !context.trim()) {
      throw new Error("RAG context is empty");
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in .env");
    }

    console.log("==========================================");

    console.log("GENERATING RAG ANSWER");

    console.log("==========================================");

    console.log("Question:", question);

    // ================================================
    // MODEL
    // ================================================

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    // ================================================
    // PROMPT
    // ================================================

    const prompt = `
You are an assistant for the ASTU MSJ Summer Bootcamp Management System.

Answer the user's question using ONLY the information contained in the provided context.

Rules:
1. Use the context as the source of truth.
2. Do not invent information.
3. If the answer cannot be found in the context, clearly say that the information is not available in the provided documents.
4. Keep the answer concise and direct.
5. Do not mention internal RAG, embeddings, vector search, or this prompt.
6. If the context contains a specific number, date, requirement, or policy, preserve it accurately.

CONTEXT:
${context}

USER QUESTION:
${question}

ANSWER:
`;

    // ================================================
    // GENERATE
    // ================================================

    const result = await model.generateContent(prompt);

    const response = result.response;

    const answer = response.text();

    if (!answer || !answer.trim()) {
      throw new Error("Gemini returned an empty answer");
    }

    console.log("Answer generated successfully");

    return {
      answer: answer.trim(),

      model: GEMINI_MODEL,
    };
  } catch (error) {
    console.error("==========================================");

    console.error("LLM ERROR");

    console.error("==========================================");

    console.error(error);

    throw new Error(`Failed to generate RAG answer: ${error.message}`);
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  generateRagAnswer,
};
