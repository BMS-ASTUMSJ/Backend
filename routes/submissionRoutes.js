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

// ============================================================
// STUDENT - FIRST SUBMISSION / RESUBMISSION
// ============================================================

router.post("/", protect, authorize("student"), submitAssignment);

// ============================================================
// STUDENT - UPDATE PENDING SUBMISSION
// ============================================================

router.put("/:id", protect, authorize("student"), updateSubmission);

// ============================================================
// STUDENT - MY SUBMISSIONS
// ============================================================

router.get("/my", protect, authorize("student"), getMySubmissions);

// ============================================================
// MENTOR / ADMIN - GET SUBMISSIONS
// ============================================================

router.get(
  "/assignment/:assignmentId",
  protect,
  authorize("mentor", "admin"),
  getSubmissionsByAssignment,
);

// ============================================================
// MENTOR - GRADE / REQUEST RESUBMISSION
// ============================================================

router.put("/grade/:id", protect, authorize("mentor"), gradeSubmission);

module.exports = router;
