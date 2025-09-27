import {
  uploadSubmission,
  getRecentSubmissions,
} from "../controllers/submission.controller.js";
import express from "express";
import upload from "../middlewares/multerMiddleware.js";
const router = express.Router();

// Get recent submissions

// Upload submission
router.post("/upload", upload.single("file"), uploadSubmission);

export default router;
