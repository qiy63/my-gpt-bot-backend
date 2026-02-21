import express from "express";
import multer from "multer";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";
import { ingestText, removeVectors } from "./ingestHelper.js";
import { uploadBuffer } from "../utils/cloudinary.js";

const router = express.Router();

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const upload = multer({
  storage: multer.memoryStorage(),
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
    SELECT id, title, category, short_description, tags, status, file_url, mime_type, file_size, updated_at, created_at
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

  const contentText =
    req.file.mimetype === "text/plain" ? req.file.buffer.toString("utf8") : null;

  uploadBuffer(req.file.buffer, {
    folder: "legal_info",
    resource_type: "raw",
  })
    .then((result) => {
      const sql = `
        INSERT INTO legal_info_files
          (title, category, short_description, tags, status, file_url, mime_type, file_size, uploaded_by, content_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        sql,
        [
          title,
          category,
          short_description || null,
          tags || null,
          status || "active",
          result.secure_url,
          req.file.mimetype,
          req.file.size,
          req.user?.id || null,
          contentText,
        ],
        (err, dbResult) => {
          if (err) {
            console.error("legal_info insert error:", err);
            return res.status(500).json({ error: "DB Error" });
          }
          const payload = {
            id: dbResult.insertId,
            title,
            category,
            short_description: short_description || null,
            tags: tags || null,
            status: status || "active",
            file_url: result.secure_url,
            mime_type: req.file.mimetype,
            file_size: req.file.size,
          };

          if (contentText) {
            const sourceId = `legalinfo-${dbResult.insertId}`;
            ingestText(contentText, sourceId).catch((e) =>
              console.warn("legal_info ingest error:", e?.message || e)
            );
          }
          res.json(payload);
        }
      );
    })
    .catch((e) => {
      console.error("legal_info upload error:", e);
      res.status(500).json({ error: "Upload failed" });
    });
});

// Update entry (metadata + optional new file)
router.put("/:id", verifyToken, verifyAdmin, upload.single("file"), (req, res) => {
  const { title, category, short_description, tags, status } = req.body;
  const id = req.params.id;

  const selectSql = "SELECT file_url, content_text FROM legal_info_files WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("legal_info select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const oldUrl = rows[0].file_url || null;
    const existingContent = rows[0].content_text || null;

    const doUpdate = (fileUrl, contentText, mimeType, fileSize) => {
      const updateSql = `
        UPDATE legal_info_files
        SET title = ?, category = ?, short_description = ?, tags = ?, status = ?, file_url = ?, mime_type = ?, file_size = ?, content_text = ?, updated_at = NOW()
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
          fileUrl,
          mimeType,
          fileSize,
          contentText,
          id,
        ],
        async (updErr) => {
          if (updErr) {
            console.error("legal_info update error:", updErr);
            return res.status(500).json({ error: "DB Error" });
          }

          if (contentText) {
            const sourceId = `legalinfo-${id}`;
            removeVectors(sourceId)
              .catch((e) => console.warn("legal_info remove vectors error:", e?.message || e))
              .finally(() =>
                ingestText(contentText, sourceId).catch((e) =>
                  console.warn("legal_info ingest error:", e?.message || e)
                )
              );
          }
          res.json({ message: "Updated" });
        }
      );
    };

    if (!req.file) {
      return doUpdate(oldUrl, existingContent, null, null);
    }

    const contentText =
      req.file.mimetype === "text/plain" ? req.file.buffer.toString("utf8") : null;

    uploadBuffer(req.file.buffer, {
      folder: "legal_info",
      resource_type: "raw",
    })
      .then((result) => doUpdate(result.secure_url, contentText, req.file.mimetype, req.file.size))
      .catch((e) => {
        console.error("legal_info upload error:", e);
        res.status(500).json({ error: "Upload failed" });
      });
  });
});

// Delete entry
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
  const id = req.params.id;
  const selectSql = "SELECT file_url FROM legal_info_files WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("legal_info select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const delSql = "DELETE FROM legal_info_files WHERE id = ?";
    db.query(delSql, [id], (delErr) => {
      if (delErr) {
        console.error("legal_info delete error:", delErr);
        return res.status(500).json({ error: "DB Error" });
      }
      const sourceId = `legalinfo-${id}`;
      removeVectors(sourceId).catch((e) =>
        console.warn("legal_info remove vectors error:", e?.message || e)
      );
      res.json({ message: "Deleted" });
    });
  });
});

// Download file
router.get("/:id/download", verifyToken, verifyAdmin, (req, res) => {
  const sql = "SELECT file_url FROM legal_info_files WHERE id = ?";
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) {
      console.error("legal_info download lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (!rows[0].file_url) return res.status(404).json({ error: "File missing" });
    return res.redirect(rows[0].file_url);
  });
});

// Rebuild embeddings for all legal_info files (txt only ingested)
router.post("/reindex", verifyToken, verifyAdmin, async (_req, res) => {
  const sql = "SELECT id, content_text FROM legal_info_files";
  db.query(sql, async (err, rows) => {
    if (err) {
      console.error("legal_info reindex query error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    const results = [];
    for (const row of rows) {
      const sourceId = `legalinfo-${row.id}`;
      try {
        await removeVectors(sourceId);
        if (row.content_text) {
          await ingestText(row.content_text, sourceId);
          results.push({ id: row.id, status: "ok" });
        } else {
          results.push({ id: row.id, status: "skipped", message: "No text content" });
        }
      } catch (e) {
        console.warn("legal_info reindex item error:", e?.message || e);
        results.push({ id: row.id, status: "error", message: e?.message || String(e) });
      }
    }
    res.json({ items: results });
  });
});

export default router;
