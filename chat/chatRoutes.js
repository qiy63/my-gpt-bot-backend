import express from "express";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";

const router = express.Router();

const summarizeTitle = (text) => {
  const words = text.trim().split(/\s+/).slice(0, 8).join(" ");
  return words.length > 60 ? `${words.slice(0, 60)}...` : words;
};

router.get("/conversations", verifyToken, (req, res) => {
  const sql = `
    SELECT id, title, created_at, updated_at
    FROM chat_conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `;
  db.query(sql, [req.user?.id], (err, rows) => {
    if (err) {
      console.error("chat conversations list error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({ items: rows });
  });
});

router.post("/conversations", verifyToken, (req, res) => {
  const title = req.body?.title ? String(req.body.title).trim() : null;
  const sql = `
    INSERT INTO chat_conversations (user_id, title, created_at, updated_at)
    VALUES (?, ?, NOW(), NOW())
  `;
  db.query(sql, [req.user?.id, title], (err, result) => {
    if (err) {
      console.error("chat conversation insert error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({ id: result.insertId, title });
  });
});

router.get("/conversations/:id/messages", verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const convSql = "SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?";
  db.query(convSql, [conversationId, req.user?.id], (err, rows) => {
    if (err) {
      console.error("chat conversation lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const msgSql = `
      SELECT id, role, content, created_at
      FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY id ASC
    `;
    db.query(msgSql, [conversationId], (msgErr, messages) => {
      if (msgErr) {
        console.error("chat messages list error:", msgErr);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({ items: messages });
    });
  });
});

router.post("/conversations/:id/messages", verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const role = String(req.body?.role || "").toLowerCase();
  const content = String(req.body?.content || "").trim();

  if (!content || (role !== "user" && role !== "assistant")) {
    return res.status(400).json({ error: "role and content are required" });
  }

  const convSql = "SELECT id, title FROM chat_conversations WHERE id = ? AND user_id = ?";
  db.query(convSql, [conversationId, req.user?.id], (err, rows) => {
    if (err) {
      console.error("chat conversation lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const insertSql = `
      INSERT INTO chat_messages (conversation_id, role, content, created_at)
      VALUES (?, ?, ?, NOW())
    `;
    db.query(insertSql, [conversationId, role, content], (insErr, result) => {
      if (insErr) {
        console.error("chat message insert error:", insErr);
        return res.status(500).json({ error: "DB Error" });
      }

      const updates = [];
      const params = [];

      updates.push("updated_at = NOW()");
      if (!rows[0].title && role === "user") {
        updates.push("title = ?");
        params.push(summarizeTitle(content));
      }

      if (updates.length) {
        const updateSql = `UPDATE chat_conversations SET ${updates.join(", ")} WHERE id = ?`;
        params.push(conversationId);
        db.query(updateSql, params, (updErr) => {
          if (updErr) {
            console.error("chat conversation update error:", updErr);
          }
          res.json({ id: result.insertId });
        });
      } else {
        res.json({ id: result.insertId });
      }
    });
  });
});

export default router;
