import express from "express";
import {db} from "../auth/db.js";
import verifyToken from "../auth/verifyToken.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { error } from "console";

const router = express.Router();

// multer for image upload
const uploadDir = path.join(process.cwd(), "profile", "upload");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true});

const storage = multer.diskStorage({

    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {

        const ext = path.extname(file.originalname);
        cb(null, `user_${req.user.id}_${Date.now()}${ext}`);

    }

});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024}}); // => 5MB

// GET prof
router.get("/profile", verifyToken, (req, res) => {

    const userId = req.user.id;

    const sql = `SELECT u.id as user_id, u.email, p.* FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1`;

    db.query(sql, [userId], (err, results) => {

        if (err) {

            console.error("profile GET error: ", err);

            return res.status(500).json({ error: "DB Error"});

        }

        const profile = results[0] || null;

        res.json({profile});

    });

});

// PUT update prof
router.put("/profile", verifyToken, (req, res) => {

    const userId = req.user.id;
    const {

        full_name,
        phone,
        gender,
        birthdate,
        address,
        occupation,
        national_id,
        profile_picture

    } = req.body;

    // if profile exist
    

});