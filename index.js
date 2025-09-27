import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";

// Importing routes
import userRoutes from "./routes/user.routes.js";
import submissionRoutes from "./routes/submission.routes.js";

const API_TEMPLATE = "/api/v1";
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// routes
app.use(API_TEMPLATE + "/users", userRoutes);
app.use(API_TEMPLATE + "/submissions", submissionRoutes);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
});
