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

    destination: "profile/upload",
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
    const checkSql = "SELECT id FROM user_profiles WHERE user_id = ?";
    
    db.query(checkSql, [userId], (err, rows) => {

        if (err) return res.status(500).json({ error: "DB Error "});

        if (rows.length > 0){

            // update
            const updateSql = `
            
                UPDATE user_profiles SET
                    full_name = ?, phone = ?, gender = ?, birthdate = ?, address = ?, occupation = ?, national_id = ?, profile_picture = ?
                WHERE user_id = ?

            `;

            db.query(updateSql, [full_name, phone, gender, birthdate, address, occupation, national_id, profile_picture, userId], (err2) => {

                if (err2) {

                    console.error("profile update error : ", err2);
                    return res.status(500).json({ error: "DB Error" });

                }
                res.json({ message: "Profile Updated" });

            });

        }else{

            //insert
            const insertSql = `
            
                INSERT INTO user_profiles
                    (user_id, full_name, phone, gender, birthdate, address, occupation, national_id, profile_picture)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

            `;

            db.query(insertSql, [userId, full_name, phone, gender, birthdate, address, occupation, national_id, profile_picture], (err3) => {

                if (err3) {

                    console.error("profile insert error: ", err3);
                    return res.status(500).json({ error: "DB Error" });

                }

                res.json({ message: "Profile Created"});
                
            });

        }

    });

});

// POST upload prof pic
router.post("/profile/upload", verifyToken, upload.single("picture"), (req, res) => {

    if (!req.file) return res.status(400).json({error: "No file uploaded"});

    // save file path in db
    const filePath = req.file.filename;

    const sql = `
    
        INSERT INTO user_profiles (user_id, profile_picture)
            VALUES (?, ?)
        ON DUPLICATE KEY UPDATE profile_picture = VALUES(profile_picture)

    `;

    db.query(sql, [req.user.id, filePath], (err) => {

        if (err) console.error("upload db update err: ", err);
        res.json({fileName: req.file.filename});

    });

});

export default router;