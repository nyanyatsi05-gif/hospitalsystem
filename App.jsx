
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";
const LOGIN_URL = `${API}/doctors/login`;
const DOCTORS_URL = `${API}/doctors`;
const APPOINTMENTS_URL = `${API}/appointments`;

function App() {
  const [page, setPage] = useState("Dashboard");
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [token, setToken] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [patientName, setPatientName] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("All");

  const [notifications, setNotifications] = useState([]);

  // Load real doctor IDs from MySQL.
  useEffect(() => {
    async function fetchDoctors() {
      try {
        const response = await fetch(DOCTORS_URL);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load doctors.");
        }

        setDoctors(data);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoadingDoctors(false);
      }
    }

    fetchDoctors();
  }, []);

  // Get appointments using the current doctor's token.
  async function loadAppointments(authToken) {
    if (!authToken) {
      setAppointments([]);
      return;
    }

    setLoadingAppointments(true);

    try {
      const response = await fetch(APPOINTMENTS_URL, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load appointments.");
      }

      // This list comes from the backend, filtered by the logged-in doctor.
      setAppointments(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error) {
      setAppointments([]);
      setMessage(error.message);
    } finally {
      setLoadingAppointments(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed.");
      }

      if (!data.token || !data.doctor) {
        throw new Error("Doctor login information was not returned.");
      }

      setToken(data.token);
      setDoctor(data.doctor);
      setLoginPassword("");
      setAppointments([]);
      setPage("Staff Dashboard");

      await loadAppointments(data.token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    setDoctor(null);
    setToken("");
    setAppointments([]);
    setLoginEmail("");
    setLoginPassword("");
    setEditingId(null);
    setMessage("");
    setPage("Dashboard");
  }

  function openBooking(doctorId = "") {
    setPatientName("");
    setSelectedDoctor(String(doctorId));
    setDate("");
    setTime("");
    setEditingId(null);
    setMessage("");
    setPage("Book Appointment");
  }

  async function saveAppointment(event) {
    event.preventDefault();

    if (!patientName.trim() || !selectedDoctor || !date || !time) {
      setMessage("Please complete all fields.");
      return;
    }

    const chosenDoctor = doctors.find(
      d => String(d.id) === String(selectedDoctor)
    );

    if (!chosenDoctor) {
      setMessage("Please select a valid doctor.");
      return;
    }

    if (editingId !== null && !token) {
      setMessage("Please log in as a doctor first.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const url = editingId !== null
        ? `${APPOINTMENTS_URL}/${editingId}`
        : APPOINTMENTS_URL;

      const booking = {
        patientName: patientName.trim(),
        doctorId: chosenDoctor.id,
        date,
        time
      };

      const response = await fetch(url, {
        method: editingId !== null ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(editingId !== null
            ? { Authorization: `Bearer ${token}` }
            : {})
        },
        body: JSON.stringify(booking)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not save appointment.");
      }

      setNotifications(old => [
        `${editingId !== null ? "Updated" : "Booked"} appointment for ${patientName.trim()} with ${chosenDoctor.name}.`,
        ...old
      ]);

      setEditingId(null);
      setMessage(
        editingId !== null
          ? "Appointment updated successfully."
          : "Appointment booked successfully."
      );

      if (token && doctor) {
        await loadAppointments(token);
        setPage("Staff Dashboard");
      } else {
        setPage("Appointments");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function editAppointment(appointment) {
    setEditingId(appointment.id);
    setPatientName(appointment.patientName || "");
    setSelectedDoctor(String(appointment.doctorId));
    setDate(String(appointment.date).slice(0, 10));
    setTime(appointment.time || "");
    setMessage("");
    setPage("Book Appointment");
  }

  async function cancelAppointment(appointment) {
    if (!token || !doctor) {
      setMessage("Please log in first.");
      return;
    }

    if (!window.confirm("Cancel this appointment?")) {
      return;
    }

    try {
      const response = await fetch(
        `${APPOINTMENTS_URL}/${appointment.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not cancel appointment.");
      }

      await loadAppointments(token);
      setMessage("Appointment cancelled successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const specialties = [
    "All",
    ...new Set(doctors.map(d => d.specialty))
  ];

  const filteredDoctors = doctors.filter(d => {
    const matchesName = d.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesSpecialty =
      specialty === "All" || d.specialty === specialty;

    return matchesName && matchesSpecialty;
  });

  function renderDoctorCards(list) {
    if (loadingDoctors) return <p>Loading doctors...</p>;

    if (list.length === 0) return <p>No doctors found.</p>;

    return (
      <div className="doctor-grid">
        {list.map(d => (
          <article className="doctor-card" key={d.id}>
            <div className="doctor-avatar">✚</div>
            <h3>{d.name}</h3>
            <p>{d.specialty}</p>
            <button
              className="primary-button"
              onClick={() => openBooking(d.id)}
            >
              Book Appointment
            </button>
          </article>
        ))}
      </div>
    );
  }

  function renderBooking() {
    return (
      <section className="section-card form-card">
        <h2>{editingId !== null ? "Update Appointment" : "Book an Appointment"}</h2>

        <form onSubmit={saveAppointment}>
          <label htmlFor="patientName">Patient name</label>
          <input
            id="patientName"
            value={patientName}
            onChange={e => setPatientName(e.target.value)}
            required
          />

          <label htmlFor="doctor">Choose a doctor</label>
          <select
            id="doctor"
            value={selectedDoctor}
            onChange={e => setSelectedDoctor(e.target.value)}
            required
            disabled={editingId !== null}
          >
            <option value="">Select a doctor</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty}
              </option>
            ))}
          </select>

          <label htmlFor="date">Appointment date</label>
          <input
            id="date"
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />

          <label htmlFor="time">Appointment time</label>
          <select
            id="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            required
          >
            <option value="">Select a time</option>
            {[
              "09:00 AM",
              "10:00 AM",
              "11:00 AM",
              "12:00 PM",
              "01:00 PM",
              "02:00 PM",
              "03:00 PM"
            ].map(t => <option key={t}>{t}</option>)}
          </select>

          {message && <p role="status">{message}</p>}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId !== null ? "Update Appointment" : "Confirm Booking"}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setEditingId(null);
              setMessage("");
              setPage(doctor ? "Staff Dashboard" : "Dashboard");
            }}
          >
            Back
          </button>
        </form>
      </section>
    );
  }

  function renderStaffDashboard() {
    if (!doctor || !token) {
      return (
        <section className="section-card form-card">
          <h2>Doctor Login</h2>
          <form onSubmit={handleLogin}>
            <label htmlFor="loginEmail">Email address</label>
            <input
              id="loginEmail"
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              required
            />

            <label htmlFor="loginPassword">Password</label>
            <input
              id="loginPassword"
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              required
            />

            {message && <p role="alert">{message}</p>}

            <button className="primary-button" type="submit">
              Doctor Login
            </button>
          </form>
        </section>
      );
    }

    return (
      <section className="section-card">
        <div className="section-heading">
          <div>
            <h2>Doctor Dashboard</h2>
            <p>Welcome, {doctor.name}</p>
          </div>
          <button className="secondary-button" onClick={logout}>
            Logout
          </button>
        </div>

        <p>Total appointments: {appointments.length}</p>

        <button
          className="primary-button"
          onClick={() => loadAppointments(token)}
        >
          Refresh Appointments
        </button>

        {message && <p role="status">{message}</p>}

        {loadingAppointments ? (
          <p>Loading appointments...</p>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <h3>No appointments assigned to you</h3>
          </div>
        ) : (
          <div className="appointment-list">
            {appointments.map(a => (
              <article className="appointment-card" key={a.id}>
                <div className="appointment-info">
                  <h3>{a.patientName}</h3>
                  <p>Doctor: {a.doctorName}</p>
                  <p>Specialty: {a.specialty}</p>
                  <p>Date: {String(a.date).slice(0, 10)}</p>
                  <p>Time: {a.time}</p>
                </div>

                <div className="appointment-actions">
                  <button
                    className="secondary-button"
                    onClick={() => editAppointment(a)}
                  >
                    Update
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => cancelAppointment(a)}
                  >
                    Cancel
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderPatientAppointments() {
    return (
      <section className="section-card">
        <h2>Appointments</h2>
        <p>For privacy, doctors' appointment lists are available after doctor login.</p>
        <button className="primary-button" onClick={() => openBooking()}>
          Book an Appointment
        </button>
        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  function renderPage() {
    switch (page) {
      case "Dashboard":
        return (
          <>
            <section className="welcome">
              <p className="eyebrow">YOUR HEALTH, OUR PRIORITY</p>
              <h2>Welcome to our hospital</h2>
              <p>Find a doctor and book an appointment.</p>
              <button className="primary-button" onClick={() => openBooking()}>
                + Book an appointment
              </button>
            </section>
            <section className="section-card">
              <h2>Available doctors</h2>
              {renderDoctorCards(doctors.slice(0, 3))}
            </section>
          </>
        );

      case "Find a Doctor":
        return (
          <section className="section-card">
            <h2>Find a doctor</h2>
            <div className="filters">
              <input
                placeholder="Search doctors..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                value={specialty}
                onChange={e => setSpecialty(e.target.value)}
              >
                {specialties.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {renderDoctorCards(filteredDoctors)}
          </section>
        );

      case "Book Appointment":
        return renderBooking();

      case "Appointments":
        return renderPatientAppointments();

      case "Staff Dashboard":
        return renderStaffDashboard();

      case "Notifications":
        return (
          <section className="section-card">
            <h2>Notifications</h2>
            {notifications.length === 0
              ? <p>No new notifications.</p>
              : notifications.map((n, i) => <p key={i}>{n}</p>)}
          </section>
        );

      default:
        return null;
    }
  }

  const menuItems = [
    "Dashboard",
    "Find a Doctor",
    "Book Appointment",
    "Appointments",
    "Staff Dashboard",
    "Notifications"
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✚</div>
          <div>
            <h1>HealthCare</h1>
            <span>Appointment System</span>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <nav>
          {menuItems.map(item => (
            <button
              key={item}
              className={`nav-button ${page === item ? "active" : ""}`}
              onClick={() => {
                setMessage("");
                if (item === "Book Appointment") {
                  openBooking();
                } else {
                  setEditingId(null);
                  setPage(item);
                }
              }}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Hospital / {page}</p>
            <h2>{page}</h2>
          </div>
          {doctor && (
            <button className="secondary-button" onClick={logout}>
              Log out
            </button>
          )}
        </header>

        <div className="page-content">{renderPage()}</div>

        <footer className="footer">
          Hospital Appointment Booking System · Student project
        </footer>
      </main>
    </div>
  );
}

export default App;
