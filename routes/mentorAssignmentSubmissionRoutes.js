const express = require("express");

const router = express.Router();

const {
  submitMentorAssignment,
  getMentorAssignmentSubmissions,
  giveMentorFeedback,
  getMyMentorSubmissions,
} = require("../controllers/mentorAssignmentSubmissionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// ======================================================
// STUDENT SUBMITS
// ======================================================

router.post("/", protect, authorize("student"), submitMentorAssignment);

// ======================================================
// STUDENT SEES OWN SUBMISSIONS
// ======================================================

router.get("/my", protect, authorize("student"), getMyMentorSubmissions);

// ======================================================
// MENTOR SEES SUBMISSIONS
// ======================================================

router.get(
  "/assignment/:assignmentId",
  protect,
  authorize("mentor"),
  getMentorAssignmentSubmissions,
);

// ======================================================
// MENTOR GIVES FEEDBACK
// ======================================================

router.put("/feedback/:id", protect, authorize("mentor"), giveMentorFeedback);

module.exports = router;
