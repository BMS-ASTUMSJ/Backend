const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ======================================================
// UPLOAD DIRECTORY
// ======================================================

const uploadDirectory = path.join(__dirname, "..", "uploads", "assignments");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// ======================================================
// ALLOWED EXTENSIONS
// ======================================================

const allowedExtensions = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".zip",
  ".rar",
];

// ======================================================
// STORAGE
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    cb(null, uniqueFileName);
  },
});

// ======================================================
// FILE FILTER
// ======================================================

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    return cb(
      new Error(
        "Unsupported file type. Allowed files: PDF, Word, PowerPoint, Excel, TXT, ZIP and RAR.",
      ),
    );
  }

  cb(null, true);
};

// ======================================================
// MULTER INSTANCE
// ======================================================

const upload = multer({
  storage: storage,

  fileFilter: fileFilter,

  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

module.exports = upload;
