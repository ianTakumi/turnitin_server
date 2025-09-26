import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${process.env.PORT}`);
});
