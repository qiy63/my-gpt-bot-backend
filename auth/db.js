import mysql from "mysql2";

export const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mygptbot_auth",
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    multipleStatements: true
});

db.connect(err => {

    if (err) console.error("DB error: ", err);
    else console.log("MySQL connected");

});
