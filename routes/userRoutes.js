const express = require("express");

const { createUser } = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/createUser", protect, authorize("admin"), createUser);

module.exports = router;
