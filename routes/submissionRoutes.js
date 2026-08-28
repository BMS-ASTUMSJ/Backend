const express = require("express");

const router = express.Router();

const {
  submitAssignment,
  updateSubmission,
  gradeSubmission,
  getSubmissionsByAssignment,
  getMySubmissions,
} = require("../controllers/submissionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// ======================================================
// STUDENT
// ======================================================

// Student submits normal/admin assignment
router.post("/", protect, authorize("student"), submitAssignment);

// Student updates pending submission
router.put("/:id", protect, authorize("student"), updateSubmission);

// Student sees own submissions
router.get("/my", protect, authorize("student"), getMySubmissions);

// ======================================================
// MENTOR
// ======================================================

// Mentor sees submissions for admin assignment
router.get(
  "/assignment/:assignmentId",
  protect,
  authorize("mentor"),
  getSubmissionsByAssignment,
);

// Mentor grades admin assignment
router.put("/grade/:id", protect, authorize("mentor"), gradeSubmission);

module.exports = router;
