import {
  uploadSubmission,
  getRecentSubmissions,
  downloadSubmissionFile,
} from "../controllers/submission.controller.js";
import express from "express";
import upload from "../middlewares/multerMiddleware.js";
const router = express.Router();

// Download route
router.get("/download", downloadSubmissionFile);

// Get recent submissions
router.get("/:id", getRecentSubmissions);

// Upload submission
router.post("/upload", upload.single("file"), uploadSubmission);

export default router;
