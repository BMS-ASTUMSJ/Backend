const express = require("express");

const router = express.Router();

const {
  completeProjectTracking,
  getProjectTracking,
} = require("../controllers/projectTrackingController");

const protect = require("../middleware/authMiddleware");

const authorize = require("../middleware/roleMiddleware");

// ============================================================
// COMPLETE PROJECT TRACKING
//
// This is the ONLY endpoint that creates a tracking record.
//
// Frontend calls this ONLY when every student is completed.
// ============================================================

router.post("/complete", protect, authorize("mentor"), completeProjectTracking);

// ============================================================
// GET COMPLETED PROJECT TRACKING
//
// This only reads existing completed tracking.
// ============================================================

router.get("/:assignmentId", protect, authorize("mentor"), getProjectTracking);

module.exports = router;
