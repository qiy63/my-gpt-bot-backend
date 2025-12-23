import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";

const router = express.Router();

// Ensure upload dir exists
const uploadDir = path.join(process.cwd(), "feedback", "upload");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage for screenshots
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `feedback_${req.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Create feedback
router.post("/", verifyToken, upload.single("screenshot"), (req, res) => {
  const userId = req.user.id;
  const { message, rating } = req.body;
  const ratingNum = rating ? Number(rating) : null;
  if (!message) return res.status(400).json({ error: "Message is required" });

  const screenshot = req.file ? req.file.filename : null;
  const sql = `
    INSERT INTO feedback (user_id, message, rating, screenshot)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [userId, message, ratingNum, screenshot], (err, result) => {
    if (err) {
      console.error("feedback insert error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({
      id: result.insertId,
      user_id: userId,
      message,
      rating: ratingNum,
      screenshot_url: screenshot
        ? `http://localhost:4000/feedback/upload/${screenshot}`
        : null,
      created_at: new Date().toISOString(),
    });
  });
});

// List current user's feedback
router.get("/", verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT id, user_id, message, rating, screenshot,
           CONCAT('http://localhost:4000/feedback/upload/', screenshot) AS screenshot_url,
           created_at
    FROM feedback
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("feedback fetch error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({ feedback: rows });
  });
});

export default router;