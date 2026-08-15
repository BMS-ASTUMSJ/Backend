const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const applicantRoutes = require("./routes/applicantRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const app = express();

app.use(cors());

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

connectDB();
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/applicant", applicantRoutes);
app.use("/api/announcements", announcementRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ASTU MSJ Bootcamp Management System API is running",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    }),
  );

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
