"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

export default function LoginPage() {
  useEffect(() => {
    // Always clear user_id when visiting login page
    localStorage.removeItem('user_id');
  }, []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const form = new URLSearchParams();
    form.append("username", username.trim());
    form.append("password", password.trim());
    form.append("grant_type", "password");
    try {
      console.log('[Login] Request body:', form.toString());
      const res = await fetch("http://localhost:8000/api/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      console.log('[Login] Response:', data);
      if (!res.ok) {
        let details = [];
        if (data.detail) details.push(`API error: ${data.detail}`);
        if (data.raw) details.push(`Raw response: ${data.raw}`);
        details.push(`Status: ${res.status} ${res.statusText}`);
        setError(details.join(' | '));
        return;
      }
      setSuccess(`Login successful! Welcome, ${username}`);
      localStorage.setItem('user_id', data.user_id);
      if (data.first_name) {
        localStorage.setItem('first_name', data.first_name);
      }
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
      }
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
    } catch (err: any) {
      setError(`Network error: ${err?.message || err}`);
      console.error('[Login] Network error:', err);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #232b36 0%, #3a4756 100%)',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif'
    }}>
      <div style={{
        background: '#fff',
        padding: 40,
        borderRadius: 18,
        boxShadow: '0 8px 32px rgba(35,43,54,0.12)',
        minWidth: 340,
        maxWidth: 380,
        width: '100%',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ marginBottom: 24 }}>
          <Image src="/logo.png" alt="BracketWorks Logo" width={64} height={64} style={{ marginBottom: 8 }} />
          <h1 style={{ fontWeight: 700, fontSize: 28, color: '#232b36', margin: 0 }}>BracketWorks</h1>
          <div style={{ color: '#888', fontSize: 16, marginTop: 4 }}>Bowling Brackets & Side Pots</div>
        </div>
  <form onSubmit={handleLogin} style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 18 }}>
            <input
              type="text"
              id="login-username"
              name="username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 16,
                background: '#f8f9fb',
                marginBottom: 2
              }}
              autoComplete="username"
              required
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <input
              type="password"
              id="login-password"
              name="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 16,
                background: '#f8f9fb',
                marginBottom: 2
              }}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 8,
            background: 'linear-gradient(90deg, #f0a500 0%, #f7c873 100%)',
            color: '#232b36',
            fontWeight: 700,
            fontSize: 18,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(240,165,0,0.08)',
            marginTop: 8
          }}>Login</button>
        </form>
        {/* Tournament Info Card */}
        <div style={{
          marginTop: 32,
          background: '#f8fafd',
          borderRadius: 14,
          boxShadow: '0 2px 8px #232b3608',
          padding: '22px 28px',
          border: '1.5px solid #dbe2ea',
          textAlign: 'left',
          width: '100%',
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#232b36', marginBottom: 12 }}>Loaded Tournament</h2>
          <div style={{ fontSize: 16, color: '#232b36', marginBottom: 6 }}><strong>Name:</strong> Example Open</div>
          <div style={{ fontSize: 16, color: '#232b36', marginBottom: 6 }}><strong>Location:</strong> Main Lanes</div>
          <div style={{ fontSize: 16, color: '#232b36', marginBottom: 6 }}><st