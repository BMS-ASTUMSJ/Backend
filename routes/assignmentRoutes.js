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

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/authorize");
const upload = require("../middleware/upload");

router.get("/", protect, getAssignments);

router.get("/history", protect, getAssignmentHistory);

router.get("/:id", protect, getAssignment);

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

module.exports = router;
