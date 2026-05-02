"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./lib/auth-context";





export default function HomePage() {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, isInitialized, router]);

  return null;
}


