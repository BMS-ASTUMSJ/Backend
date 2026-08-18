const express = require("express");

const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", protect, getAnnouncements);

router.get("/:id", protect, getAnnouncement);

router.post("/", protect, authorize("admin"), createAnnouncement);

router.patch("/:id", protect, authorize("admin"), updateAnnouncement);

router.delete("/:id", protect, authorize("admin"), deleteAnnouncement);

module.exports = router;
