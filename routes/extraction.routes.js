const express = require("express");

const upload = require("../middleware/upload");
const extractionController = require("../controllers/extraction.controller");

const router = express.Router();

router.post(
  "/extract",
  upload.single("file"),
  extractionController.extractDocumentText,
);

module.exports = router;
