const express = require("express");

const router = express.Router();

const {
  createMentorAssignment,
  getMentorAssignments,
  getStudentMentorAssignments,
  getMentorAssignment,
} = require("../controllers/mentorAssignmentController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");

router.post(
  "/mentor-create",
  protect,
  authorize("mentor"),
  upload.array("files", 10),
  createMentorAssignment,
);

router.get("/mentor", protect, authorize("mentor"), getMentorAssignments);

router.get(
  "/student",
  protect,
  authorize("student"),
  getStudentMentorAssignments,
);

router.get(
  "/:id",
  protect,
  authorize("mentor", "student"),
  getMentorAssignment,
);

module.exports = router;
