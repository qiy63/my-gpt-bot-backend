import mysql from "mysql2";

export const db = mysql.createConnection({

    host: "localhost",
    user: "root",
    password: "",
    database: "mygptbot_auth",
    multipleStatements: true

});

db.connect(err => {

    if (err) console.error("DB error: ", err);
    else console.log("MySQL connected");

});