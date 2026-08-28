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
const upload = require("../middleware/upload");

router.get("/", protect, getAssignments);

router.get("/history", protect, getAssignmentHistory);

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

router.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("files", 10),
  createAssignment,
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.array("files", 10),
  updateAssignment,
);
router.delete("/:id", protect, authorize("admin"), deleteAssignment);

router.get(
  "/mentor/:id",
  protect,
  authorize("mentor", "student"),
  getMentorAssignment,
);

router.get("/:id", protect, getAssignment);

module.exports = router;
