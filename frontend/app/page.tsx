"use client";

import { useEffect, useState } from "react";

import { useAuth } from "./lib/auth-context";








export default function HomePage() {
  const { isAuthenticated, isInitialized } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    // Immediate redirect as soon as we have auth state
    if (!mounted) return;
    
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  }, [isAuthenticated, mounted]);
  
  // Minimal loading state - redirect happens almost immediately
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    </div>
  );
}

