const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Extract text from uploaded files.
 *
 * Supported:
 * - PDF
 * - DOCX
 * - TXT
 */
const extractTextFromFile = async (file) => {
  // ==========================================
  // VALIDATE FILE
  // ==========================================

  if (!file) {
    throw new Error("No file was uploaded");
  }

  if (!file.path) {
    throw new Error("Uploaded file path is missing");
  }

  if (!file.originalname) {
    throw new Error("Uploaded file name is missing");
  }

  // Get file extension
  const extension = file.originalname.split(".").pop().toLowerCase();

  console.log("==========================================");
  console.log("Starting text extraction");
  console.log("Original filename:", file.originalname);
  console.log("File path:", file.path);
  console.log("File type:", extension);
  console.log("==========================================");

  // ==========================================
  // PDF
  // ==========================================

  if (extension === "pdf") {
    console.log("Extracting text from PDF...");

    const dataBuffer = fs.readFileSync(file.path);

    if (!dataBuffer || dataBuffer.length === 0) {
      throw new Error("The uploaded PDF file is empty");
    }

    let parser;

    try {
      // pdf-parse v2.x API
      parser = new PDFParse({
        data: dataBuffer,
      });

      const result = await parser.getText();

      const text = result?.text || "";

      console.log("PDF extraction completed");
      console.log("Extracted characters:", text.length);

      if (!text.trim()) {
        console.warn("PDF extraction completed, but no text was found.");
      }

      return text;
    } catch (error) {
      console.error("PDF extraction error:", error);

      throw new Error(`Failed to extract PDF text: ${error.message}`);
    } finally {
      // Always release parser resources
      if (parser) {
        try {
          await parser.destroy();
        } catch (destroyError) {
          console.error("PDF parser cleanup error:", destroyError);
        }
      }
    }
  }

  // ==========================================
  // DOCX
  // ==========================================

  if (extension === "docx") {
    console.log("Extracting text from DOCX...");

    try {
      const result = await mammoth.extractRawText({
        path: file.path,
      });

      const text = result?.value || "";

      console.log("DOCX extraction completed");
      console.log("Extracted characters:", text.length);

      if (!text.trim()) {
        console.warn("DOCX extraction completed, but no text was found.");
      }

      // Mammoth may return warnings
      if (result.messages && result.messages.length > 0) {
        console.log("DOCX extraction messages:", result.messages);
      }

      return text;
    } catch (error) {
      console.error("DOCX extraction error:", error);

      throw new Error(`Failed to extract DOCX text: ${error.message}`);
    }
  }

  // ==========================================
  // TXT
  // ==========================================

  if (extension === "txt") {
    console.log("Extracting text from TXT...");

    try {
      const text = fs.readFileSync(file.path, "utf8");

      console.log("TXT extraction completed");
      console.log("Extracted characters:", text.length);
      console.log("Extracted text:", JSON.stringify(text));

      return text;
    } catch (error) {
      console.error("TXT extraction error:", error);

      throw new Error(`Failed to extract TXT text: ${error.message}`);
    }
  }

  // ==========================================
  // UNSUPPORTED FILE TYPE
  // ==========================================

  throw new Error(
    `Unsupported file type: ${extension}. Supported file types are PDF, DOCX, and TXT.`,
  );
};

// ==========================================
// EXPORT
// ==========================================

module.exports = {
  extractTextFromFile,
};
