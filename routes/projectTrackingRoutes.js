const express = require("express");

const router = express.Router();

const {
  completeProjectTracking,
  getProjectTracking,
} = require("../controllers/projectTrackingController");

const protect = require("../middleware/authMiddleware");

const authorize = require("../middleware/roleMiddleware");

router.post("/complete", protect, authorize("mentor"), completeProjectTracking);

router.get("/:assignmentId", protect, authorize("mentor"), getProjectTracking);

module.exports = router;
