"use client";

import { useEffect, useState } from "react";

import { useAuth } from "./lib/auth-context";








export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted) return; // Wait for client-side hydration
    
    // Only redirect to login if not authenticated
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    
    if (!isAuthenticated && !token && !userId) {
      window.location.href = "/login";
    } else if (isAuthenticated || (token && userId)) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, mounted]);
  
  if (!mounted) {
    // Return a consistent loading state for SSR
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Loading...</p>
    </div>
  );
}
