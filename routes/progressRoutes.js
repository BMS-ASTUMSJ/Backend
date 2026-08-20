const express = require("express");

const router = express.Router();

const progressController =
  require("../controllers/progressController");

const protect =
  require("../middleware/authMiddleware");

// ======================================================
// ADMIN / CONTENT
// ======================================================

router.post(
  "/content",
  protect,
  progressController.createProgressContent
);

router.get(
  "/content",
  protect,
  progressController.getProgressContent
);

router.get(
  "/content/:contentId",
  protect,
  progressController.getContentById
);

router.patch(
  "/content/:contentId/unpublish",
  protect,
  progressController.unpublishProgressContent
);

// ======================================================
// STUDENT
// ======================================================

router.get(
  "/student/dashboard",
  protect,
  progressController.getProgressDashboard
);

router.get(
  "/student/progress",
  protect,
  progressController.getStudentProgress
);

router.patch(
  "/student/progress/:contentId",
  protect,
  progressController.updateStudentProgress
);

router.get(
  "/student/summary",
  protect,
  progressController.getStudentSummary
);

router.get(
  "/student/rank",
  protect,
  progressController.getStudentRank
);

// ======================================================
// MENTOR
// ======================================================

// All students assigned to logged-in mentor
router.get(
  "/mentor/progress",
  protect,
  progressController.getMentorProgress
);

// At-risk students
router.get(
  "/mentor/falling-behind",
  protect,
  progressController.getFallingBehindStudents
);

// ======================================================
// ADMIN
// ======================================================

router.get(
  "/students/progress",
  protect,
  progressController.getOverallProgress
);

module.exports = router;