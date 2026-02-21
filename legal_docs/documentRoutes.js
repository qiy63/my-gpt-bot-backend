import express from "express";
import multer from "multer";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";
import { uploadBuffer } from "../utils/cloudinary.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
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

  const doInsert = (fileUrl) => {
    const sql = `
      INSERT INTO documents
        (category_id, title, short_description, prerequisites, required_docs, file_url, placeholder_url, uploaded_by)
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
        fileUrl,
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
          file_url: fileUrl || null,
          placeholder_url: placeholder_url || null,
        });
      }
    );
  };

  if (!req.file) {
    return doInsert(null);
  }

  uploadBuffer(req.file.buffer, {
    folder: "guided_documents",
    resource_type: "raw",
  })
    .then((result) => doInsert(result.secure_url))
    .catch((e) => {
      console.error("documents upload error:", e);
      res.status(500).json({ error: "Upload failed" });
    });
});

// Admin update document (metadata + optional new file)
router.put("/:id", verifyToken, verifyAdmin, upload.single("file"), (req, res) => {
  const { title, category_id, short_description, prerequisites, required_docs, placeholder_url } = req.body;
  const id = req.params.id;

  const selectSql = "SELECT file_url FROM documents WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("documents select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const oldUrl = rows[0].file_url || null;

    const finishUpdate = (fileUrl) => {
      const updateSql = `
        UPDATE documents
        SET category_id = ?, title = ?, short_description = ?, prerequisites = ?, required_docs = ?, file_url = ?, placeholder_url = ?
        WHERE id = ?
      `;

      db.query(
        updateSql,
        [
          category_id,
          title,
          short_description || null,
          prerequisites || null,
          required_docs || null,
          fileUrl,
          placeholder_url || null,
          id,
        ],
        (updErr) => {
          if (updErr) {
            console.error("documents update error:", updErr);
            return res.status(500).json({ error: "DB Error" });
          }
          res.json({ message: "Updated" });
        }
      );
    };

    if (!req.file) return finishUpdate(oldUrl);

    uploadBuffer(req.file.buffer, {
      folder: "guided_documents",
      resource_type: "raw",
    })
      .then((result) => finishUpdate(result.secure_url))
      .catch((e) => {
        console.error("documents upload error:", e);
        res.status(500).json({ error: "Upload failed" });
      });
  });
});

// Admin delete document
router.delete("/:id", verifyToken, verifyAdmin, (req, res) => {
  const id = req.params.id;
  const selectSql = "SELECT file_url FROM documents WHERE id = ?";
  db.query(selectSql, [id], (selErr, rows) => {
    if (selErr) {
      console.error("documents select error:", selErr);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const delSql = "DELETE FROM documents WHERE id = ?";
    db.query(delSql, [id], (delErr) => {
      if (delErr) {
        console.error("documents delete error:", delErr);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({ message: "Deleted" });
    });
  });
});

// Download or redirect to placeholder
router.get("/:id/download", verifyToken, (req, res) => {
  const sql = "SELECT file_url, placeholder_url FROM documents WHERE id = ?";
  db.query(sql, [req.params.id], (err, rows) => {
    if (err) {
      console.error("documents download lookup error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const doc = rows[0];
    if (doc.file_url) return res.redirect(doc.file_url);
    if (doc.placeholder_url) return res.redirect(doc.placeholder_url);
    return res.status(404).json({ error: "No file available" });
  });
});

export default router;
