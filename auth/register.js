import express from "express";
import bcrypt from "bcryptjs";
import {db} from "./db.js";

const router = express.Router();

router.post("/register", (req, res) => {

    const {name, email, password} = req.body;

    // check user
    const checkUser = "SELECT * FROM users WHERE email = ?";
    db.query(checkUser, [email], (err, result) => {

        if (result.length > 0){

            return res.status(400).json({error: "Email Already Exists"});

        }

        // hash pass
        const hashedPassword = bcrypt.hashSync(password, 10);

        // insert user (default role: user)
        const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";

        db.query(sql, [name, email, hashedPassword, "user"], (err) => {

            if (err) return res.status(500).json({error: "Database error"});

            res.json({message: "User Registered Successfully"});

        });

    });

});

export default router;
