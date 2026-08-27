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
You are the ASTU MSJ Summer Bootcamp Assistant.

Answer the user's question directly and naturally using the provided information.

Rules:
- Give a direct, natural, conversational answer in one or two sentences.
- Do not say "Based on the provided context".
- Do not say "According to the documents".
- Do not mention the context, documents, RAG, embeddings, vector search, or sources.
- Do not add unnecessary explanations.
- If the answer is clearly available, give the exact answer.
- If the question asks "which university", answer naturally using the university name in a complete sentence.
- If the question asks "who", give the person or role directly.
- If the question asks "when", give the date or year directly.
- Only say the information is unavailable if the answer truly cannot be found.

INFORMATION:
${context}

QUESTION:
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
