const express = require("express");

const router = express.Router();

const { uploadProfileImage } = require("../controllers/profileController");
const protect = require("../middleware/authMiddleware");
const uploadProfile = require("../middleware/uploadProfile");

router.put(
  "/profile-image",
  protect,
  uploadProfile.single("profileImage"),
  uploadProfileImage,
);

module.exports = router;
