const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const multer = require("multer");

const connectDB = require("./config/db");

// ============================================================
// ROUTES
// ============================================================
const Document = require("./models/document.model");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const batchRoutes = require("./routes/batchRoutes");
const profileRoutes = require("./routes/profileRoutes");
const applicantRoutes = require("./routes/applicantRoutes");
const teamRoutes = require("./routes/teamRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const attendanceRoutes = require("./routes/attendanceRoute");
const sessionRoutes = require("./routes/sessionRoutes");
const batchHistoryRoutes = require("./routes/batchHistoryRoutes");
const progressRoutes = require("./routes/progressRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const projectTrackingRoutes = require("./routes/projectTrackingRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const atRiskRoutes = require("./routes/atRiskRoutes");
const documentRoutes = require("./routes/document.routes");
const mentorAssignmentSubmissionRoutes = require("./routes/mentorAssignmentSubmissionRoutes");
const extractionRoutes = require("./routes/extraction.routes");
const retrievalRoutes = require("./routes/retrieval.routes");
const ragRoutes = require("./routes/rag.routes");
const chatRoutes = require("./routes/chat.routes");
// ============================================================
// APP
// ============================================================

const app = express();

// ============================================================
// CORS
// ============================================================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.CLIENT_URL?.replace(/\/$/, ""),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.some((allowed) => allowed.replace(/\/$/, "") === normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json());

app.use(cookieParser());

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ============================================================
// STATIC FILES
// ============================================================

// Assignment uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// AT-RISK ROUTES
// ============================================================
app.use("/api/at-risk", atRiskRoutes);

// ============================================================
// DATABASE
// ============================================================

connectDB();

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/batches", batchRoutes);

app.use("/api/applicants", applicantRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/teams", teamRoutes);

app.use("/api/announcements", announcementRoutes);

app.use("/api/assignments", assignmentRoutes);

app.use("/api/project-tracking", projectTrackingRoutes);

app.use("/api/submissions", submissionRoutes);
app.use("/api/retrieval", retrievalRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/extraction", extractionRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/chat", chatRoutes);
app.post("/test/document", async (req, res) => {
  try {
    const document = await Document.create({
      title: "Test Bootcamp Document",
      type: "text",
      source: "manual",
      status: "processed",
    });

    res.status(201).json({
      success: true,
      document,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});
// ============================================================
// SESSION ROUTES
// ============================================================
// Mentor Attendance uses:
// GET /api/sessions/my-team
//
// This was missing before, which caused the 404 error.
// ============================================================

app.use("/api/sessions", sessionRoutes);

app.use("/api/batch-history", batchHistoryRoutes);

app.use("/api/progress", progressRoutes);

app.use("/api/mentor-assignment-submissions", mentorAssignmentSubmissionRoutes);

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ASTU MSJ Bootcamp Management System API is running",
  });
});

// ============================================================
// 404
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// MUST COME AFTER ALL ROUTES
// ============================================================

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  // ==========================================================
  // MULTER ERRORS
  // ==========================================================

  if (err instanceof multer.MulterError) {
    // File too large
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each uploaded file must not be larger than 20 MB.",
      });
    }

    // Too many files
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message:
          "Too many files uploaded. You can upload a maximum of 10 files.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "File upload error.",
    });
  }

  // ==========================================================
  // CUSTOM FILE TYPE ERROR
  // ==========================================================

  if (
    err.message?.includes("Unsupported file type") ||
    err.message?.includes("Invalid file type")
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // ==========================================================
  // GENERAL ERROR
  // ==========================================================

  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
});

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
