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
  changeUserBatch,
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// CREATE USER
// ADMIN ONLY
// ============================================================

router.post("/", protect, authorize("admin"), createUser);

// ============================================================
// DELETE USER
// ADMIN ONLY
// ============================================================

router.delete("/:id", protect, authorize("admin"), deleteUser);

// ============================================================
// GET MENTORS
// ADMIN ONLY
// ============================================================

router.get("/mentors", protect, authorize("admin"), getMentors);

// ============================================================
// GET STUDENTS
// ADMIN ONLY
// ============================================================

router.get("/students", protect, authorize("admin"), getStudents);

// ============================================================
// ASSIGN MENTOR
// ADMIN ONLY
// ============================================================

router.patch("/assign-mentor", protect, authorize("admin"), assignMentor);

// ============================================================
// CHANGE USER BATCH / ROLE
// ADMIN ONLY
// ============================================================

router.patch("/:id/batch", protect, authorize("admin"), changeUserBatch);

// ============================================================
// UPDATE USER STATUS
// ADMIN ONLY
// ============================================================

router.patch("/:id/status", protect, authorize("admin"), updateUserStatus);

// ============================================================
// BLACKLIST / SUSPENDED USERS
// ADMIN ONLY
// ============================================================

router.get("/blacklist", protect, authorize("admin"), getBlacklistedUsers);

// ============================================================
// CURRENT USER PROFILE
// ============================================================

router.get("/profile", protect, getProfile);

// ============================================================
// UPDATE CURRENT USER PROFILE
// ============================================================

router.patch("/profile", protect, updateProfile);

module.exports = router;
