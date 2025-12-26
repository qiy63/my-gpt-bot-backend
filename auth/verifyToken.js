import jwt from "jsonwebtoken";
import "dotenv/config";

export default function verifyToken(req, res, next) {

    try{

        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;
        
        if (!token) {
            
            return res.status(401).json({error: "No token provided"});

        }

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

            if (err) {
                
                return res.status(401).json({error: "Invalid token"});
            
            }

            req.user = {

                id: decoded.id,
                email: decoded.email,
                role: decoded.role || "user",

            }

            next();

        });

    } catch (err) {

        console.error("verifyToken error: ", err);
        res.status(500).json({error: "Server Error"});

    }

}
