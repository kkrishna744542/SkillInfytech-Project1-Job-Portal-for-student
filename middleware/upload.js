import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createStorage(destinationFolder) {
  return multer.diskStorage({
    destination(req, file, callback) {
      callback(null, destinationFolder);
    },
    filename(req, file, callback) {
      const safeBaseName = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, "-");
      callback(
        null,
        `${Date.now()}-${safeBaseName}${path.extname(file.originalname)}`
      );
    },
  });
}

const imageUpload = multer({
  storage: createStorage(path.join(__dirname, "..", "uploads", "profiles")),
  fileFilter(req, file, callback) {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only image files are allowed for profile photo uploads."));
  },
});

const resumeUpload = multer({
  storage: createStorage(path.join(__dirname, "..", "uploads", "resumes")),
  fileFilter(req, file, callback) {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Upload a resume in PDF or Word format."));
  },
});

export { imageUpload, resumeUpload };