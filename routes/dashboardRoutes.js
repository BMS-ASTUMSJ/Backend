const express = require("express");
const router = express.Router();
const {
  getStudentDashboardMetrics,
} = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware"); // Ensure you use your JWT auth middleware

router.get("/student/metrics", protect, getStudentDashboardMetrics);

module.exports = router;
