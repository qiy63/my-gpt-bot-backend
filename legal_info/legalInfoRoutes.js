import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "legal_info");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `legalinfo_${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

// List all legal info entries
router.get("/", verifyToken, verifyAdmin, (_req, res) => {
  const sql = `
    SELECT id, title, category, short_description, tags, status, filename, mime_type, file_size, updated_at, created_at
    FROM legal_info_files
    ORDER BY updated_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("legal_info list error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json({ items: rows });
  });
});

// Create new entry
router.post("/", verifyToken, verifyAdmin, upload.single("file"), (req, res) => {
  const { title, category, short_description, tags, status } = req.body;
  if (!title || !category) return res.status(400).json({ error: "title and category are required" });
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const sql = `
    INSERT INTO legal_info_files
      (title, category, short_description, tags, status, filename, mime_type, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [
      title,
      category,
      short_description || null,
      tags || null,
      status || "active",
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      req.user?.id || null,
    ],
    (err, result) => {
      if (err) {
        console.error("legal_info insert error:", err);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({
        id: result.insertId,
        title,
        category,
        short_description: short_description || null,
        tags: tags || null,
        status: status || "active",
        filename: req.file.filename,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
      });
    }
  );
});

// Update entry (metadata + optional new file)
router.put("/:id", verifyToken, verifyAdmin, upload.single("file"), (req, res) => {
  const { title, category, short_description, tags, status } = req.body;
  const id = req.params.id;

  const selectSql = "SELECT filename FROM legal_info_files WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("legal_info select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const oldFilename = rows[0].filename;
    const newFilename = req.file ? req.file.filename : oldFilename;

    const updateSql = `
      UPDATE legal_info_files
      SET title = ?, category = ?, short_description = ?, tags = ?, status = ?, filename = ?, mime_type = ?, file_size = ?, updated_at = NOW()
      WHERE id = ?
    `;

    db.query(
      updateSql,
      [
        title,
        category,
        short_description || null,
        tags || null,
        status || "active",
        newFilename,
        req.file ? req.file.mimetype : null,
        req.file ? req.file.size : null,
        id,
      ],
      (updErr) => {
        if (updErr) {
          console.error("legal_info update error:", updErr);
          return res.status(500).json({ error: "DB Error" });
        }
        if (req.file && oldFilename && oldFilename !== newFilename) {
          const oldPath = path.join(uploadDir, oldFilename);
          if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
        }
        res.json({ message: "Updated" });
      }
    );
  });
});

// Delete entry
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
  const id = req.params.id;
  const selectSql = "SELECT filename FROM legal_info_files WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("legal_info select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const filename = rows[0].filename;

    const delSql = "DELETE FROM legal_info_files WHERE id = ?";
    db.query(delSql, [id], (delErr) => {
      if (delErr) {
        console.error("legal_info delete error:", delErr);
        return res.status(500).json({ error: "DB Error" });
      }
      if (filename) {
        const filePath = path.join(uploadDir, filename);
        if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      }
      res.json({ message: "Deleted" });
    });
  });
});

// Download file
router.get("/:id/download", verifyToken, verifyAdmin, (req, res) => {
  const sql = "SELECT filename FROM legal_info_files WHERE id = ?";
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) {
      console.error("legal_info download lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const filePath = path.join(uploadDir, rows[0].filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
    return res.download(filePath);
  });
});

export default router;
