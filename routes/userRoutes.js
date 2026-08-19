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

// ==========================================
// CREATE USER
// ==========================================
router.post(
  "/",
  protect,
  authorize("admin"),
  createUser
);

// ==========================================
// DELETE USER
// ==========================================
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteUser
);

// ==========================================
// GET MENTORS
// ==========================================
router.get(
  "/mentors",
  protect,
  authorize("admin"),
  getMentors
);

// ==========================================
// GET STUDENTS
// ==========================================
router.get(
  "/students",
  protect,
  authorize("admin"),
  getStudents
);

// ==========================================
// ASSIGN MENTOR
// ==========================================
router.patch(
  "/assign-mentor",
  protect,
  authorize("admin"),
  assignMentor
);

// ==========================================
// UPDATE USER STATUS
// ==========================================
router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateUserStatus
);

// ==========================================
// GET BLACKLISTED USERS
// ==========================================
router.get(
  "/blacklist",
  protect,
  authorize("admin"),
  getBlacklistedUsers
);

// ==========================================
// GET MY PROFILE
// ==========================================
router.get(
  "/profile",
  protect,
  getProfile
);


// ==========================================
router.patch(
  "/profile",
  protect,
  updateProfile
);

module.exports = router;