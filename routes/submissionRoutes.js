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

router.post("/", protect, authorize("student"), submitAssignment);

router.put("/:id", protect, authorize("student"), updateSubmission);

router.get("/my", protect, authorize("student"), getMySubmissions);

router.get(
  "/assignment/:assignmentId",
  protect,
  authorize("mentor", "admin"),
  getSubmissionsByAssignment,
);

router.put("/grade/:id", protect, authorize("mentor"), gradeSubmission);

module.exports = router;
