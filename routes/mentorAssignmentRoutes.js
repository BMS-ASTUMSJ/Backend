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

// ======================================================
// MENTOR ASSIGNMENT ROUTES
// ======================================================

// ======================================================
// CREATE ASSIGNMENT
// POST /api/assignments/mentor-create
// ======================================================

router.post(
  "/mentor-create",
  protect,
  authorize("mentor"),
  upload.array("files", 10),
  createMentorAssignment,
);

// ======================================================
// GET ASSIGNMENTS CREATED BY CURRENT MENTOR
// GET /api/assignments/mentor
// ======================================================

router.get("/mentor", protect, authorize("mentor"), getMentorAssignments);

// ======================================================
// GET ASSIGNMENTS ASSIGNED TO CURRENT STUDENT
// GET /api/assignments/student
// ======================================================

router.get(
  "/student",
  protect,
  authorize("student"),
  getStudentMentorAssignments,
);

// ======================================================
// GET ONE ASSIGNMENT
// GET /api/assignments/:id
// ======================================================

router.get(
  "/:id",
  protect,
  authorize("mentor", "student"),
  getMentorAssignment,
);

module.exports = router;
