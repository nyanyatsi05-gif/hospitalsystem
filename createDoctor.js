
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const doctors = [
  {
    name: "Dr. Thabo Mokoena",
    email: "thabo@hospital.com",
    password: "Thabo@123"
  },
  {
    name: "Dr. Lerato Ndlovu",
    email: "lerato@hospital.com",
    password: "Lerato@123"
  },
  {
    name: "Dr. Palesa Khumalo",
    email: "palesa@hospital.com",
    password: "Palesa@123"
  },
  {
    name: "Dr. Khotso Molefe",
    email: "khotso@hospital.com",
    password: "Khotso@123"
  },
  {
    name: "Dr. Mamello Rantso",
    email: "mamello@hospital.com",
    password: "Mamello@123"
  }
];

async function createDoctors() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      )
    `);

    for (const doctor of doctors) {
      const hashedPassword = await bcrypt.hash(
        doctor.password,
        10
      );

      await connection.execute(
        `INSERT INTO doctors (name, email, password)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password = VALUES(password)`,
        [doctor.name, doctor.email, hashedPassword]
      );

      console.log(`Created account: ${doctor.email}`);
    }

    console.log("All five doctor accounts are ready.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createDoctors();
