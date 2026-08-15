const express = require("express");

const {
  createUser,
  updateUserStatus,
  getBlacklistedUsers,
  assignMentor,
  getStudents,
  getMentors,
  getProfile,
  updateProfile,
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");


const router = express.Router();


router.post(
  "/createuser",
  protect,
  authorize("admin"),
  createUser
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateUserStatus
);

router.get(
  "/blacklisted",
  protect,
  authorize("admin"),
  getBlacklistedUsers
);

router.get(
  "/students",
  protect,
  authorize("admin"),
  getStudents
);

router.get(
  "/mentors",
  protect,
  authorize("admin"),
  getMentors
);

router.patch(
  "/assign-mentor",
  protect,
  authorize("admin"),
  assignMentor
);

router.get(
  "/profile",
  protect,
  getProfile
);

router.patch(
  "/profile",
  protect,
  updateProfile
);

module.exports = router;