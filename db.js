import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "5658@",
    database: process.env.DB_NAME || "hospital_appointments",
    waitForConnections: true,
    connectionLimit: 10
});

export default db;