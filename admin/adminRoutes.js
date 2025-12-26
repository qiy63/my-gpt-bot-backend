import express from "express";
import verifyToken from "../auth/verifyToken.js";
import { db } from "../auth/db.js";

const router = express.Router();

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// Login metrics: total and per-day counts in a date range (optional)
router.get("/metrics/logins", verifyToken, verifyAdmin, (req, res) => {
  const { from, to } = req.query;
  const params = [];
  const where = [];

  if (from) {
    where.push("created_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("created_at <= ?");
    params.push(to);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalSql = `SELECT COUNT(*) as total FROM login_events ${whereClause}`;
  const dailySql = `
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM login_events
    ${whereClause}
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `;

  db.query(totalSql, params, (err, totalRows) => {
    if (err) {
      console.error("admin metrics total error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    db.query(dailySql, params, (err2, dailyRows) => {
      if (err2) {
        console.error("admin metrics daily error:", err2);
        return res.status(500).json({ error: "DB Error" });
      }
      res.json({
        total: totalRows[0]?.total || 0,
        daily: dailyRows,
      });
    });
  });
});

// All feedback (admin)
router.get("/feedback", verifyToken, verifyAdmin, (_req, res) => {
  const sql = `
    SELECT f.id, f.user_id, f.message, f.rating, f.screenshot, f.created_at, u.name AS user_name, u.email
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT 200
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("admin feedback list error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    const mapped = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      message: r.message,
      rating: r.rating,
      screenshot_url: r.screenshot
        ? `http://localhost:4000/feedback/upload/${r.screenshot}`
        : null,
      created_at: r.created_at,
      user_name: r.user_name || "Unknown",
      email: r.email || "",
    }));
    res.json({ feedback: mapped });
  });
});

export default router;
