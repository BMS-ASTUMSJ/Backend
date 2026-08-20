const express = require("express");

const router = express.Router();

const {
  createSession,
  generateWeekSessions,
  listSessionsForBatch,
  listSessionsForMentor,
  deleteSession,
} = require("../controllers/sessionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// Mentor: read-only, sees sessions for their own team's batch
router.get("/my-team", protect, authorize("mentor"), listSessionsForMentor);

// Admin: full session configuration
router.post("/", protect, authorize("admin"), createSession);
router.post(
  "/generate-week",
  protect,
  authorize("admin"),
  generateWeekSessions,
);
router.get(
  "/batch/:batchId",
  protect,
  authorize("admin"),
  listSessionsForBatch,
);
router.delete("/:sessionId", protect, authorize("admin"), deleteSession);

module.exports = router;
