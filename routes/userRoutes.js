const express = require("express");

const {
  createUser,
  deleteUser,
  updateUserStatus,
  getBlacklistedUsers,
  assignMentor,
  getStudents,
  getMentors,
  getMyStudents,
  getMyRiskStatus,
  getStudentDashboard,
  updateStudentRiskStatus,
  getAtRiskStudents,
  getProfile,
  updateProfile,
  changeUserBatch,
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", protect, authorize("admin"), createUser);

router.delete("/:id", protect, authorize("admin"), deleteUser);

router.get("/mentors", protect, authorize("admin"), getMentors);

router.get("/students", protect, authorize("admin"), getStudents);

router.get("/my-students", protect, authorize("mentor"), getMyStudents);

router.get("/my-risk-status", protect, authorize("student"), getMyRiskStatus);

router.get(
  "/student-dashboard",
  protect,
  authorize("student"),
  getStudentDashboard,
);

router.get("/at-risk", protect, authorize("admin"), getAtRiskStudents);

router.patch(
  "/:id/risk-status",
  protect,
  authorize("admin"),
  updateStudentRiskStatus,
);

router.patch("/assign-mentor", protect, authorize("admin"), assignMentor);

router.patch("/:id/batch", protect, authorize("admin"), changeUserBatch);

router.patch("/:id/status", protect, authorize("admin"), updateUserStatus);

router.get("/blacklist", protect, authorize("admin"), getBlacklistedUsers);

router.get("/profile", protect, getProfile);

router.patch("/profile", protect, updateProfile);

module.exports = router;
