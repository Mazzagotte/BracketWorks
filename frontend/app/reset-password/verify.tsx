"use client";
import { useState } from "react";

export default function VerifyResetPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/v1/users/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Verification failed");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Network error. Try again.");
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fb" }}>
      <form onSubmit={handleVerify} style={{ background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", minWidth: 320 }}>
        <h2 style={{ marginBottom: 24 }}>Verify Reset Code</h2>
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
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        {message && <div style={{ color: "green", marginBottom: 12 }}>{message}</div>}
        <button type="submit" style={{ width: "100%", padding: 10, borderRadius: 6, background: "#0070f3", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Verify Code</button>
      </form>
    </main>
  );
}
