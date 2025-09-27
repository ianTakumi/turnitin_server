import { getUsers, createUser } from "../controllers/user.controller.js";
import express from "express";
const router = express.Router();

// Get all users
router.get("/", getUsers);

// Create user
router.post("/create-user", createUser);

export default router;
