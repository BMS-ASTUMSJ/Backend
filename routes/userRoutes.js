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


router.delete(
  "/:id",
  protect,
  authorize("admin"),
  deleteUser
);

router.get(
  "/mentors",
  protect,
  authorize("admin"),
  getMentors
);


router.get(
  "/students",
  protect,
  authorize("admin"),
  getStudents
);

router.patch(
  "/assign-mentor",
  protect,
  authorize("admin"),
  assignMentor
);


router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateUserStatus
);


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