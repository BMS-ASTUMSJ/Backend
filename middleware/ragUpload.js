const multer = require("multer");
const path = require("path");
const fs = require("fs");



const uploadDirectory = path.join(__dirname, "..", "uploads", "rag");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}



const allowedExtensions = [".pdf", ".doc", ".docx", ".txt"];



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueFileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${extension}`;

    cb(null, uniqueFileName);
  },
});



const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    return cb(
      new Error(
        "Unsupported file type. Only PDF, DOC, DOCX, and TXT files are allowed.",
      ),
    );
  }

  cb(null, true);
};



const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});


module.exports = upload;
