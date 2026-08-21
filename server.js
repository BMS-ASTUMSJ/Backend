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

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const batchRoutes = require("./routes/batchRoutes");
const applicantRoutes = require("./routes/applicantRoutes");
const teamRoutes = require("./routes/teamRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const attendanceRoutes = require("./routes/attendanceRoute");
const batchHistoryRoutes = require("./routes/batchHistoryRoutes");
const progressRoutes = require("./routes/progressRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const atRiskRoutes = require("./routes/atRiskRoutes");
const profileRoutes = require("./routes/profileRoutes");

// ============================================================
// APP
// ============================================================

const app = express();

// ============================================================
// CORS CONFIGURATION
// ============================================================

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
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
app.use(express.urlencoded({ extended: true }));

// ============================================================
// STATIC FILES
// ============================================================

// Assignment uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// DATABASE
// ============================================================

connectDB();

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/applicants", applicantRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/batch-history", batchHistoryRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/at-risk", atRiskRoutes);

// ============================================================
// ROOT & HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ASTU MSJ Bootcamp Management System API is running",
  });
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`,
  });
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  // ==========================================================
  // MULTER ERRORS
  // ==========================================================

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each uploaded file must not be larger than 20 MB.",
      });
    }

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

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error.",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
});

// ============================================================
// SERVER INITIALIZATION
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
