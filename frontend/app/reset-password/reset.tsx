"use client";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await fetch("/api/v1/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Reset failed");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Network error. Try again.");
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <form onSubmit={handleReset} style={{ background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", minWidth: 320 }}>
        <h2 style={{ marginBottom: 24 }}>Reset Password</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 16 }}
          required
        />
        <input
          type="text"
          placeholder="Reset Code"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 16 }}
          required
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 16 }}
          required
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 16 }}
          required
        />
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        {message && <div style={{ color: "green", marginBottom: 12 }}>{message}</div>}
        <button type="submit" style={{ width: "100%", padding: 10, borderRadius: 6, background: "#0070f3", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Reset Password</button>
      </form>
    </main>
  );
}
