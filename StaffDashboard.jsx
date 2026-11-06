
import { useState } from "react";

const API_URL = "http://localhost:5000/api";

function StaffDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Log in the doctor
  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/doctors/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      setToken(data.token);
      setDoctor(data.doctor);
      setPassword("");

      await loadAppointments(data.token);
    } catch (error) {
      setMessage(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  // Load appointments after login
  async function loadAppointments(authToken) {
    try {
      const response = await fetch(`${API_URL}/appointments`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load appointments.");
      }

      setAppointments(Array.isArray(data) ? data : data.appointments || []);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Could not load appointments.");
    }
  }

  // Update an appointment
  async function updateAppointment(appointment) {
    const newDate = window.prompt(
      "Enter the new appointment date (YYYY-MM-DD):",
      String(appointment.appointment_date).slice(0, 10)
    );

    if (newDate === null) return;

    const newTime = window.prompt(
      "Enter the new appointment time:",
      appointment.appointment_time
    );

    if (newTime === null) return;

    if (!newDate.trim() || !newTime.trim()) {
      setMessage("Please enter both a date and a time.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/appointments/${appointment.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            appointment_date: newDate,
            appointment_time: newTime
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not update appointment.");
      }

      setMessage("Appointment updated successfully.");
      await loadAppointments(token);
    } catch (error) {
      setMessage(error.message || "Could not update appointment.");
    }
  }

  // Cancel an appointment
  async function cancelAppointment(id) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/appointments/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not cancel appointment.");
      }

      setMessage("Appointment cancelled successfully.");
      await loadAppointments(token);
    } catch (error) {
      setMessage(error.message || "Could not cancel appointment.");
    }
  }

  // Log out the doctor
  function handleLogout() {
    setToken("");
    setDoctor(null);
    setAppointments([]);
    setEmail("");
    setPassword("");
    setMessage("");
  }

  // Login screen
  if (!doctor) {
    return (
      <div style={styles.page}>
        <form style={styles.loginBox} onSubmit={handleLogin}>
          <h1 style={styles.heading}>Doctor Login</h1>
          <p style={styles.subtitle}>
            Log in to access the staff dashboard.
          </p>

          <label style={styles.label}>Email Address</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {message && <p style={styles.error}>{message}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  // Staff dashboard after login
  return (
    <div style={styles.page}>
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.heading}>Staff Dashboard</h1>
            <p>Welcome, Dr. {doctor.name}</p>
          </div>

          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <h2>Patient Appointments</h2>

        <button
          style={styles.button}
          onClick={() => loadAppointments(token)}
        >
          Refresh Appointments
        </button>

        {message && <p>{message}</p>}

        {appointments.length === 0 ? (
          <p>No appointments found.</p>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.cell}>Patient</th>
                  <th style={styles.cell}>Doctor</th>
                  <th style={styles.cell}>Specialty</th>
                  <th style={styles.cell}>Date</th>
                  <th style={styles.cell}>Time</th>
                  <th style={styles.cell}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td style={styles.cell}>
                      {appointment.patient_name}
                    </td>
                    <td style={styles.cell}>
                      {appointment.doctor_name}
                    </td>
                    <td style={styles.cell}>
                      {appointment.specialty}
                    </td>
                    <td style={styles.cell}>
                      {String(appointment.appointment_date).slice(0, 10)}
                    </td>
                    <td style={styles.cell}>
                      {appointment.appointment_time}
                    </td>
                    <td style={styles.cell}>
                      <button
                        style={styles.editButton}
                        onClick={() => updateAppointment(appointment)}
                      >
                        Edit
                      </button>

                      <button
                        style={styles.cancelButton}
                        onClick={() => cancelAppointment(appointment.id)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f0f4f8",
    padding: "30px 15px",
    fontFamily: "Arial, sans-serif"
  },
  loginBox: {
    maxWidth: "420px",
    margin: "50px auto",
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "10px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.1)"
  },
  dashboard: {
    maxWidth: "1200px",
    margin: "0 auto",
    backgroundColor: "white",
    padding: "25px",
    borderRadius: "10px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.08)"
  },
  heading: {
    color: "#00209f",
    marginBottom: "10px"
  },
  subtitle: {
    color: "#555",
    marginBottom: "25px"
  },
  label: {
    display: "block",
    marginTop: "15px",
    marginBottom: "7px",
    fontWeight: "bold"
  },
  input: {
    width: "100%",
    padding: "12px",
    boxSizing: "border-box",
    border: "1px solid #ccc",
    borderRadius: "5px"
  },
  button: {
    backgroundColor: "#00209f",
    color: "white",
    border: "none",
    padding: "12px 18px",
    borderRadius: "5px",
    cursor: "pointer",
    marginTop: "15px"
  },
  logoutButton: {
    backgroundColor: "#555",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "5px",
    cursor: "pointer"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    marginBottom: "25px"
  },
  tableContainer: {
    overflowX: "auto",
    marginTop: "20px"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "750px"
  },
  cell: {
    padding: "12px",
    border: "1px solid #ddd",
    textAlign: "left"
  },
  editButton: {
    backgroundColor: "#009543",
    color: "white",
    border: "none",
    padding: "8px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "5px",
    marginBottom: "5px"
  },
  cancelButton: {
    backgroundColor: "#c62828",
    color: "white",
    border: "none",
    padding: "8px 10px",
    borderRadius: "4px",
    cursor: "pointer"
  },
  error: {
    color: "#c62828",
    marginTop: "15px"
  }
};

export default StaffDashboard;
