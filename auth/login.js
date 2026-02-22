import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {db} from "./db.js"; 

const router = express.Router();

router.post("/login", (req, res) => {

    const {email, password} = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error("login query error:", err);
            return res.status(500).json({ error: "DB Error" });
        }

        if (result.length === 0){

            return res.status(400).json({error: "Invalid email or password"});

        }

        const user = result[0];

        //check pass
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) {
            
            return res.status(400).json({error: "Invalid email or password"});

        }

        const role = user.role || "user"; // default to user if column absent

        // generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // log login event (best-effort)
        const logSql = "INSERT INTO login_events (user_id) VALUES (?)";
        db.query(logSql, [user.id], (logErr) => {
            if (logErr) {
                console.error("login_events insert error:", logErr);
            }
        });

        res.json({
            message: "Login Successful",
            token,
            user: { id: user.id, name: user.name, email: user.email, role }
        });

    });

});

export default router;
