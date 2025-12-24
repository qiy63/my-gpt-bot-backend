import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "legal_docs", "upload");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `doc_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// TODO: replace with real role/permission check
const verifyAdmin = (_req, _res, next) => {
  next();
};

// List categories with documents
router.get("/", verifyToken, (_req, res) => {
  const catSql = "SELECT * FROM document_categories ORDER BY sort_order, name";
  const docSql = "SELECT * FROM documents ORDER BY id DESC";

  db.query(catSql, (err, cats) => {
    if (err) {
      console.error("documents categories error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    db.query(docSql, (err2, docs) => {
      if (err2) {
        console.error("documents list error:", err2);
        return res.status(500).json({ error: "DB Error" });
      }
      const grouped = cats.map((c) => ({
        ...c,
        documents: docs.filter((d) => d.category_id === c.id),
      }));
      res.json({ categories: grouped });
    });
  });
});

// Admin upload document (metadata + optional file)
router.post("/", verifyToken, verifyAdmin, upload.single("file"), (req, res) => {
  const {
    category_id,
    title,
    short_description,
    prerequisites,
    required_docs,
    placeholder_url,
  } = req.body;

  if (!category_id || !title) {
    return res.status(400).json({ error: "category_id and title are required" });
  }

  const filename = req.file ? req.file.filename : null;
  const sql = `
    INSERT INTO documents
      (category_id, title, short_description, prerequisites, required_docs, filename, placeholder_url, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      category_id,
      title,
      short_description || null,
      prerequisites || null,
      required_docs || null,
      filename,
      placeholder_url || null,
      req.user?.id || null,
    ],
    (err, result) => {
      if (err) {
        console.error("documents insert error:", err);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({
        id: result.insertId,
        title,
        filename,
        placeholder_url: placeholder_url || null,
      });
    }
  );
});

// Download or redirect to placeholder
router.get("/:id/download", verifyToken, (req, res) => {
  const sql = "SELECT filename, placeholder_url FROM documents WHERE id = ?";
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) {
      console.error("documents download lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const doc = rows[0];
    if (doc.filename) {
      const filePath = path.join(uploadDir, doc.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
      return res.download(filePath);
    }
    if (doc.placeholder_url) return res.redirect(doc.placeholder_url);
    return res.status(404).json({ error: "No file available" });
  });
});

export default router;
