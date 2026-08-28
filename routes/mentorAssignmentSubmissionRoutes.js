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

router.post("/", protect, authorize("student"), submitMentorAssignment);

router.get("/my", protect, authorize("student"), getMyMentorSubmissions);

router.get(
  "/assignment/:assignmentId",
  protect,
  authorize("mentor"),
  getMentorAssignmentSubmissions,
);

router.put("/feedback/:id", protect, authorize("mentor"), giveMentorFeedback);

module.exports = router;
