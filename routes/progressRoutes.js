const express = require("express");
const router = express.Router();

const progressController = require("../controllers/progressController");
const protect = require("../middleware/authMiddleware");


/* =========================================================
   ADMIN - PUBLISHING CONTENT
========================================================= */

router.post(
  "/content",
  protect,
  progressController.createProgressContent
);

router.get(
  "/content",
  progressController.getProgressContent
);

router.get(
  "/content/:contentId",
  progressController.getContentById
);

router.patch(
  "/content/:contentId/unpublish",
  protect,
  progressController.unpublishProgressContent
);


/* =========================================================
   STUDENT PROGRESS
========================================================= */

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

router.patch(
  "/student/progress/:contentId",
  protect,
  progressController.updateStudentProgress
);


/* =========================================================
   OVERALL STUDENT PROGRESS
========================================================= */

router.get(
  "/students/progress",
  protect,
  progressController.getOverallProgress
);

router.get(
  "/students/progress/:gender",
  protect,
  progressController.getGenderProgress
);


/* =========================================================
   MENTOR PROGRESS
========================================================= */

router.get(
  "/mentor/progress",
  protect,
  progressController.getMentorProgress
);

router.get(
  "/mentor/:mentorId/progress",
  protect,
  progressController.getMentorProgress
);


/* =========================================================
   WEEKLY PROGRESS
========================================================= */

router.get(
  "/weekly/:week",
  protect,
  progressController.getWeeklyProgress
);


module.exports = router;