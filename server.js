
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Keep these specialties consistent with your current project.
const specialties = {
    "Dr. Thabo Mokoena": "General Practitioner",
    "Dr. Lerato Ndlovu": "Cardiologist",
    "Dr. Palesa Khumalo": "Paediatrician",
    "Dr. Khotso Molefe": "Dentist",
    "Dr. Mamello Rantso": "Dermatologist"
};

app.get("/", (req, res) => {
    res.send("Hospital Appointment Backend is running.");
});

// Verify the doctor's login token.
function verifyDoctor(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "Login security is not configured."
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Please log in as a doctor."
        });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "doctor" || !decoded.doctorId) {
            return res.status(403).json({
                message: "Doctor access required."
            });
        }

        req.doctor = decoded;
        next();
    } catch {
        return res.status(401).json({
            message: "Your session is invalid or expired. Please log in again."
        });
    }
}

// Return the real doctor IDs from MySQL for the booking form.
app.get("/api/doctors", async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT id, name, email FROM doctors ORDER BY id"
        );

        const doctors = rows.map(d => ({
            id: d.id,
            name: d.name,
            email: d.email,
            specialty: specialties[d.name] || "General Practitioner"
        }));

        res.json(doctors);
    } catch (error) {
        console.error("Get doctors error:", error);
        res.status(500).json({
            message: "Could not retrieve doctors."
        });
    }
});

// Doctor login.
app.post("/api/doctors/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email?.trim() || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: "Login security is not configured."
            });
        }

        const [rows] = await db.execute(
            "SELECT id, name, email, password FROM doctors WHERE email = ?",
            [email.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const doctor = rows[0];
        const passwordMatches = await bcrypt.compare(
            password,
            doctor.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            { doctorId: doctor.id, role: "doctor" },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            message: "Login successful.",
            token,
            doctor: {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            message: "Could not log in."
        });
    }
});

// IMPORTANT: return only appointments assigned to the logged-in doctor.
app.get("/api/appointments", verifyDoctor, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT
                id,
                patient_name AS patientName,
                doctor_id AS doctorId,
                doctor_name AS doctorName,
                specialty,
                DATE_FORMAT(appointment_date, '%Y-%m-%d') AS date,
                appointment_time AS time
             FROM appointments
             WHERE doctor_id = ?
             ORDER BY appointment_date, appointment_time`,
            [req.doctor.doctorId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Get appointments error:", error);
        res.status(500).json({
            message: "Could not retrieve appointments."
        });
    }
});

// Patient books an appointment.
app.post("/api/appointments", async (req, res) => {
    try {
        const { patientName, doctorId, date, time } = req.body;

        if (!patientName?.trim() || !doctorId || !date || !time) {
            return res.status(400).json({
                message: "Please complete all appointment fields."
            });
        }

        const [rows] = await db.execute(
            "SELECT id, name FROM doctors WHERE id = ?",
            [doctorId]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: "The selected doctor does not exist."
            });
        }

        const selectedDoctor = rows[0];
        const specialty =
            specialties[selectedDoctor.name] || "General Practitioner";

        const [result] = await db.execute(
            `INSERT INTO appointments
             (patient_name, doctor_id, doctor_name, specialty,
              appointment_date, appointment_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                patientName.trim(),
                selectedDoctor.id,
                selectedDoctor.name,
                specialty,
                date,
                time
            ]
        );

        res.status(201).json({
            message: "Appointment booked successfully.",
            id: result.insertId
        });
    } catch (error) {
        console.error("Booking error:", error);
        res.status(500).json({
            message: "Could not book appointment."
        });
    }
});

// A doctor can update only their own appointment.
app.put("/api/appointments/:id", verifyDoctor, async (req, res) => {
    try {
        const { patientName, date, time } = req.body;

        if (!patientName?.trim() || !date || !time) {
            return res.status(400).json({
                message: "Please complete all appointment fields."
            });
        }

        const [result] = await db.execute(
            `UPDATE appointments
             SET patient_name = ?,
                 appointment_date = ?,
                 appointment_time = ?
             WHERE id = ? AND doctor_id = ?`,
            [
                patientName.trim(),
                date,
                time,
                req.params.id,
                req.doctor.doctorId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Appointment not found or it does not belong to you."
            });
        }

        res.json({ message: "Appointment updated successfully." });
    } catch (error) {
        console.error("Update appointment error:", error);
        res.status(500).json({
            message: "Could not update appointment."
        });
    }
});

// A doctor can cancel only their own appointment.
app.delete("/api/appointments/:id", verifyDoctor, async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM appointments WHERE id = ? AND doctor_id = ?",
            [req.params.id, req.doctor.doctorId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Appointment not found or it does not belong to you."
            });
        }

        res.json({ message: "Appointment cancelled successfully." });
    } catch (error) {
        console.error("Cancel appointment error:", error);
        res.status(500).json({
            message: "Could not cancel appointment."
        });
    }
});

async function startServer() {
    try {
        await db.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(`Backend running at http://localhost:${PORT}`);
            console.log("MySQL database connected successfully.");
        });
    } catch (error) {
        console.error("Could not connect to MySQL:", error.message);
        process.exit(1);
    }
}

startServer();
