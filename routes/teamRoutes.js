const express = require("express");

const router = express.Router();

const {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
} = require("../controllers/teamController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// ============================================================
// CREATE TEAM
// ============================================================

router.post("/", protect, authorize("admin"), createTeam);

// ============================================================
// GET ALL TEAMS
// ============================================================

router.get("/", protect, authorize("admin", "mentor", "student"), getTeams);

// ============================================================
// GET TEAM BY ID
// ============================================================

router.get(
  "/:id",
  protect,
  authorize("admin", "mentor", "student"),
  getTeamById,
);

// ============================================================
// UPDATE TEAM
// ============================================================

router.put("/:id", protect, authorize("admin"), updateTeam);

// ============================================================
// DELETE TEAM
// ============================================================

router.delete("/:id", protect, authorize("admin"), deleteTeam);

module.exports = router;
