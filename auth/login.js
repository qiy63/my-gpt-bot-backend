import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {db} from "./db.js"; 

const router = express.Router();

router.post("/login", (req, res) => {

    const {email, password} = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], (err, result) => {

        if (result.length === 0){

            return res.status(400).json({error: "Invalid email or password"});

        }

        const user = result[0];

        //check pass
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) {
            
            return res.status(400).json({error: "Invalid email or password"});

        }

        // generate token
        const token = jwt.sign(

            {id: user.id, email: user.email},
            process.env.JWT_SECRET,
            {expiresIn: "1h"}

        );

        res.json({

            message: "Login Successful",
            token,
            user: {id: user.id, name: user.name, email: user.email}

        });

    });

});

export default router;