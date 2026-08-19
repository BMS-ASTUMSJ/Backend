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
const progressRoutes = require("./routes/progressRoutes");

const app = express();


// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

app.use(cookieParser());

app.use(
  express.urlencoded({
    extended: true,
  })
);


// ======================================================
// DATABASE
// ======================================================

connectDB();


// ======================================================
// ROUTES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/batches",
  batchRoutes
);

app.use(
  "/api/applicants",
  applicantRoutes
);

app.use(
  "/api/teams",
  teamRoutes
);

app.use(
  "/api/announcements",
  announcementRoutes
);

// ⭐ PROGRESS
app.use(
  "/api/progress",
  progressRoutes
);


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "ASTU MSJ Bootcamp Management System API is running",
  });
});


// ======================================================
// 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
  (err, req, res, next) => {
    console.error(
      "Server error:",
      err
    );

    res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
);


// ======================================================
// SERVER
// ======================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);