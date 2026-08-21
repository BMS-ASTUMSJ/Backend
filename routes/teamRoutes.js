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

router.post("/", protect, authorize("admin"), createTeam);

router.get("/", protect, authorize("admin", "mentor", "student"), getTeams);

router.get(
  "/:id",
  protect,
  authorize("admin", "mentor", "student"),
  getTeamById,
);

router.put("/:id", protect, authorize("admin"), updateTeam);

router.delete("/:id", protect, authorize("admin"), deleteTeam);

module.exports = router;
