const express = require("express");

const {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  protect,
  authorize("admin", "mentor", "student"),
  getAnnouncements,
);

router.post("/", protect, authorize("admin", "mentor"), createAnnouncement);

router.patch("/:id", protect, authorize("admin", "mentor"), updateAnnouncement);

router.delete(
  "/:id",
  protect,
  authorize("admin", "mentor"),
  deleteAnnouncement,
);

module.exports = router;
