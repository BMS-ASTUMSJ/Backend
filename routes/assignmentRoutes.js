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

const router = express.Router();


router.get("/", protect, getAssignments);


router.get(
  "/history",
  protect,
  getAssignmentHistory
);


router.get(
  "/:id",
  protect,
  getAssignment
);


router.post(
  "/",
  protect,
  authorize("admin"),
  createAssignment
);


router.patch(
  "/:id",
  protect,
  authorize("admin"),
  updateAssignment
);


router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteAssignment
);

module.exports = router;