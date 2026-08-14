const express = require("express");

const {
  registerApplicant,
  updateApplicantStatus,
} = require("../controllers/applicantController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


router.post("/register", registerApplicant);


router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateApplicantStatus
);

module.exports = router;