const express = require("express");

const {
  createUser,
  deleteUser,
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
  "/",
  protect,
  authorize("admin"),
  createUser
);
router.delete("/:id", deleteUser);


router.get(
  "/mentors",
  protect,
  authorize("admin"),
  getMentors
);

// Get all students
router.get(
  "/students",
  protect,
  authorize("admin"),
  getStudents
);

// Assign a mentor to a student
router.patch(
  "/assign-mentor",
  protect,
  authorize("admin"),
  assignMentor
);

// Suspend / approve user
router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateUserStatus
);

// Get blacklisted users
router.get(
  "/blacklist",
  protect,
  authorize("admin"),
  getBlacklistedUsers
);



router.get(
  "/profile",
  protect,
  getProfile
);


router.put(
  "/profile",
  protect,
  updateProfile
);

module.exports = router;