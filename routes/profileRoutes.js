const express = require("express");

const router = express.Router();

const {
  getProfile,
  uploadProfileImage,
  removeProfileImage,
} = require("../controllers/profileController");

const protect = require("../middleware/authMiddleware");
const uploadProfile = require("../middleware/uploadProfile");

router.get("/me", protect, getProfile);

router.patch(
  "/me",
  protect,
  uploadProfile.single("profileImage"),
  uploadProfileImage,
);

router.delete("/me/image", protect, removeProfileImage);

module.exports = router;
