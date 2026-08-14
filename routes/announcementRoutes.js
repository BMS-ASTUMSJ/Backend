const express = require("express");

const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  updateAnnouncement,
} = require("../controllers/announcementController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


router.post(
  "/",
  protect,
  authorize("admin"),
  createAnnouncement
);

router.get(
  "/",
  protect,
  getAnnouncements
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteAnnouncement
);


router.patch(
  "/:id",
  protect,
  authorize("admin"),
  updateAnnouncement
);

module.exports = router;