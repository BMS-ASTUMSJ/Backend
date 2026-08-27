const express = require("express");

const router = express.Router();

const {
  createAssignment,
  getAssignments,
  getAssignment,
  getAssignmentHistory,
  updateAssignment,
  deleteAssignment,
} = require("../controllers/assignmentController");

const {
  createMentorAssignment,
  getMentorAssignments,
  getStudentMentorAssignments,
  getMentorAssignment,
} = require("../controllers/mentorAssignmentController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const upload = require("../middleware/ragUpload");

// ======================================================
// NORMAL / ADMIN ASSIGNMENTS
// ======================================================

// All accessible normal assignments
// Admin -> all
// Mentor -> assignments belonging to accessible batches
// Student -> assignments belonging to accessible batches
router.get("/", protect, getAssignments);

// Assignment history
router.get("/history", protect, getAssignmentHistory);

// ======================================================
// MENTOR ASSIGNMENTS
// IMPORTANT: THESE MUST COME BEFORE /:id
// ======================================================

// Mentor creates assignment
router.post(
  "/mentor-create",
  protect,
  authorize("mentor"),
  upload.array("files", 10),
  createMentorAssignment,
);

// Mentor sees assignments created by themselves
router.get("/mentor", protect, authorize("mentor"), getMentorAssignments);

// Student sees assignments assigned by mentors
router.get(
  "/student",
  protect,
  authorize("student"),
  getStudentMentorAssignments,
);

// ======================================================
// ADMIN CREATES NORMAL ASSIGNMENT
// ======================================================

router.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("files", 10),
  createAssignment,
);

// ======================================================
// ADMIN UPDATES NORMAL ASSIGNMENT
// ======================================================

router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.array("files", 10),
  updateAssignment,
);

// ======================================================
// ADMIN DELETES NORMAL ASSIGNMENT
// ======================================================

router.delete("/:id", protect, authorize("admin"), deleteAssignment);

// ======================================================
// SINGLE MENTOR ASSIGNMENT
// ======================================================

router.get(
  "/mentor/:id",
  protect,
  authorize("mentor", "student"),
  getMentorAssignment,
);

// ======================================================
// SINGLE NORMAL / ADMIN ASSIGNMENT
// ======================================================

router.get("/:id", protect, getAssignment);

module.exports = router;
