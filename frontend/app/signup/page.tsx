"use client";
import { useState } from "react";

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await fetch("/api/v1/users/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, username, organization, email, password })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Signup failed");
        return;
      }
      setSuccess("Account created! You can now log in.");
  setFirstName("");
  setLastName("");
  setUsername("");
  setOrganization("");
  setEmail("");
  setPassword("");
  setConfirmPassword("");
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <form onSubmit={handleSignup} style={{ background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", minWidth: 320 }}>
        <h2 style={{ marginBottom: 24 }}>Sign Up</h2>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Organization Name (optional)"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb" }}
            required
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: "green", marginBottom: 12 }}>{success}</div>}
        <button type="submit" style={{ width: "100%", padding: 10, borderRadius: 6, background: "#0070f3", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Sign Up</button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#f0a500", textDecoration: "underline", cursor: "pointer", fontSize: 16 }}
            onClick={() => window.location.href = "/"}
          >
            Back to Login
          </button>
        </div>
      </form>
    </main>
  );
}
