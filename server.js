const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const batchRoutes = require("./routes/batchRoutes");
const applicantRoutes = require("./routes/applicantRoutes");
const teamRoutes = require("./routes/teamRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const batchHistoryRoutes = require("./routes/batchHistoryRoutes");
const progressRoutes = require("./routes/progressRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const app = express();

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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
// DATABASE
// ============================================================

connectDB();

// ============================================================
// ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/batches", batchRoutes);

app.use("/api/applicants", applicantRoutes);

app.use("/api/teams", teamRoutes);

app.use("/api/announcements", announcementRoutes);

app.use("/api/assignments", assignmentRoutes);

app.use("/api/submissions", submissionRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/batch-history", batchHistoryRoutes);

app.use("/api/progress", progressRoutes);

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
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
