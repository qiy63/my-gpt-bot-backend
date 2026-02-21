import express from "express";
import multer from "multer";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";
import { uploadBuffer } from "../utils/cloudinary.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Create feedback
router.post("/", verifyToken, upload.single("screenshot"), (req, res) => {
  const userId = req.user.id;
  const { message, rating } = req.body;
  const ratingNum = rating ? Number(rating) : null;
  if (!message) return res.status(400).json({ error: "Message is required" });

  const doInsert = async (screenshotUrl) => {
    const sql = `
      INSERT INTO feedback (user_id, message, rating, screenshot_url)
      VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [userId, message, ratingNum, screenshotUrl], (err, result) => {
      if (err) {
        console.error("feedback insert error:", err);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({
        id: result.insertId,
        user_id: userId,
        message,
        rating: ratingNum,
        screenshot_url: screenshotUrl || null,
        created_at: new Date().toISOString(),
      });
    });
  };

  if (!req.file) {
    return doInsert(null);
  }

  uploadBuffer(req.file.buffer, {
    folder: "feedback",
    resource_type: "image",
  })
    .then((result) => doInsert(result.secure_url))
    .catch((e) => {
      console.error("feedback upload error:", e);
      res.status(500).json({ error: "Upload failed" });
    });
});

// List current user's feedback
router.get("/", verifyToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
    SELECT id, user_id, message, rating, screenshot_url, created_at
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
