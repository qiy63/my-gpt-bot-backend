import express from "express";
import cors from "cors";
import {ask} from "./ask.js";
import registerRoute from "./auth/register.js";
import loginRoute from "./auth/login.js";
import verifyToken from "./auth/verifyToken.js";
import profileRoutes from "./profile/profileRoutes.js";
import feedbackRoutes from "./feedback/feedbackRoutes.js";
import documentRoutes from "./legal_docs/documentRoutes.js";
import legalInfoRoutes from "./legal_info/legalInfoRoutes.js";
import adminRoutes from "./admin/adminRoutes.js";
import chatRoutes from "./chat/chatRoutes.js";
import path from "path";

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || "";
const vercelPreviewRegex = /^https:\/\/my-gpt-bot-frontend-v2-.*-qiy63s-projects\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigin && origin === allowedOrigin) return callback(null, true);
      if (vercelPreviewRegex.test(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.use("/auth", registerRoute);
app.use("/auth", loginRoute);

app.use("/api", profileRoutes);

app.use("/feedback", feedbackRoutes);

app.use("/documents", documentRoutes);

app.use("/legal-info", legalInfoRoutes);

app.use("/chat", chatRoutes);

app.use("/admin", adminRoutes);

// api endpoint for answer
app.post("/ask", verifyToken, async (req, res) => {

    try {

        const { question } = req.body;

        if (!question) {

            return res.status(400).json({ error: "Question is required"});

        }

        // call ask RAG func
        const answer = await ask(question);

        res.json({answer});

    } catch (error) {

        console.error("Error in /ask", error);
        res.status(500).json({ error: "Server error"});

    }

});

// start server
app.listen(4000, () => {

    console.log("Backend running at localhost:4000");

});
