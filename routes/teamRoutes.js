const express = require("express");

const router = express.Router();

const {
  createTeam,
  getTeams,
  getTeamById,
  deleteTeam,
} = require("../controllers/teamController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// Create team
router.post("/", protect, authorize("admin"), createTeam);

// Get all teams
router.get("/", protect, authorize("admin", "mentor", "student"), getTeams);

// Get one team
router.get(
  "/:id",
  protect,
  authorize("admin", "mentor", "student"),
  getTeamById,
);

// Delete team
router.delete("/:id", protect, authorize("admin"), deleteTeam);

module.exports = router;
