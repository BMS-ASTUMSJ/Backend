const express = require("express");

const {
  createTeam,
  getTeams,
  getTeamById,
  deleteTeam,
} = require("../controllers/teamController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("admin"),
  createTeam
);


router.get(
  "/",
  protect,
  getTeams
);


router.get(
  "/:id",
  protect,
  getTeamById
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteTeam
);

module.exports = router;