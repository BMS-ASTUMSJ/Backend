const express = require("express");
const {
  createBatch,
  getBatches,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
} = require("../controllers/batchController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


router.get("/active-registration", getActiveRegistrationBatch);

router.get("/", protect, authorize("admin"), getBatches);
router.post("/", protect, authorize("admin"), createBatch);
router.patch("/:id/toggle-registration", protect, authorize("admin"), toggleBatchRegistration);

module.exports = router;