const express = require("express");
const router = express.Router();

const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.post(
  "/",
  protect,
  authorize("admin"),
  createAnnouncement
);

router.get(
  "/",
  protect,
  authorize("admin", "mentor", "student"),
  getAnnouncements
);

router.get(
  "/:id",
  protect,
  authorize("admin", "mentor", "student"),
  getAnnouncement
);

router.patch(
  "/:id",
  protect,
  authorize("admin"),
  updateAnnouncement
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteAnnouncement
);

module.exports = router;