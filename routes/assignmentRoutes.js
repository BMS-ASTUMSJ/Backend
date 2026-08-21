const express = require("express");

const {
  createAssignment,
  getAssignments,
  getAssignment,
  getAssignmentHistory,
  updateAssignment,
  deleteAssignment,
} = require("../controllers/assignmentController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const uploadAssignmentFiles = require("../middleware/uploadMiddleware");

const router = express.Router();

// ============================================================
// GET ASSIGNMENTS
// ============================================================

router.get("/", protect, getAssignments);

// ============================================================
// ASSIGNMENT HISTORY
// ============================================================

router.get("/history", protect, getAssignmentHistory);

// ============================================================
// GET SINGLE ASSIGNMENT
// ============================================================

router.get("/:id", protect, getAssignment);

// ============================================================
// CREATE ASSIGNMENT
// ============================================================

router.post(
  "/",
  protect,
  authorize("admin"),
  uploadAssignmentFiles.array("files", 10),
  createAssignment,
);

// ============================================================
// UPDATE ASSIGNMENT
// ============================================================

router.patch(
  "/:id",
  protect,
  authorize("admin"),
  uploadAssignmentFiles.array("files", 10),
  updateAssignment,
);

// ============================================================
// DELETE ASSIGNMENT
// ============================================================

router.delete("/:id", protect, authorize("admin"), deleteAssignment);

module.exports = router;
