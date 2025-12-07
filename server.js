import express from "express";
import cors from "cors";
import {ask} from "./ask.js";
import registerRoute from "./auth/register.js";
import loginRoute from "./auth/login.js";
import verifyToken from "./auth/verifyToken.js";
import profileRoutes from "./profile/profileRoutes.js";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", registerRoute);
app.use("/auth", loginRoute);

app.use("/profile/upload", express.static(path.join(process.cwd(), "profile", "upload")));
app.use("/api", profileRoutes);

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
app.listen(3000, () => {

    console.log("Backend running at localhost:3000");

});