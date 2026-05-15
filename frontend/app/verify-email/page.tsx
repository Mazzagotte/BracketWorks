"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API } from "../lib/api";
import loginStyles from "../login/login.module.css";

type VerificationState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const [state, setState] = useState<VerificationState>(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Verifying your email..." : "This verification link is missing or invalid.");

  useEffect(() => {
    if (!token) {
      return;
    }

    let isCancelled = false;

    const verifyEmail = async () => {
      try {
        const response = await fetch(API("/api/v1/users/verify-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof data.detail === "string" && data.detail ? data.detail : "Email verification failed.");
        }

        if (!isCancelled) {
          setState("success");
          setMessage("Your email has been verified. You can sign in now.");
        }
      } catch (error) {
        if (!isCancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Email verification failed.");
        }
      }
    };

    void verifyEmail();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const bannerClassName = useMemo(() => {
    if (state === "success") {
      return "auth-alert-success";
    }
    if (state === "error") {
      return loginStyles.errorBanner;
    }
    return loginStyles.sessionExpiredBanner;
  }, [state]);

  return (
    <div className={loginStyles.page}>
      <div className={`${loginStyles.card} ${loginStyles.resetCard}`}>
        <div className={loginStyles.logoWrap}>
          <Image
            src="/logo.svg"
            alt="BracketWorks Logo"
            width={220}
            height={220}
            className={loginStyles.logoImage}
            priority
          />
        </div>

        <div className={loginStyles.form}>
          <div className={loginStyles.formIntro}>Email Verification</div>
          <div className={bannerClassName} role="status" aria-live="polite">
            {message}
          </div>
          <div className={loginStyles.actions}>
            <Link href={state === "success" ? "/login?verified=success" : "/login"} className={loginStyles.createAccountBtn}>
              Continue to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}