"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Notice, buttonClassName } from "@bracketworks/ui";

import BWAuthShell from "../components/BWAuthShell";
import { API, apiFetch } from "../lib/api";
import styles from "./verifyEmail.module.css";

type VerificationState = "loading" | "success" | "error";

const NOTICE_TONE = { loading: "info", success: "success", error: "danger" } as const;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const isPreview = token === "preview-verify-token" || searchParams.get("preview") === "1";
  const [state, setState] = useState<VerificationState>(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Verifying your email..." : "This verification link is missing or invalid.");

  useEffect(() => {
    if (isPreview) {
      setState("success");
      setMessage("Development preview: this is how the verify email landing page looks after a successful verification.");
      return;
    }

    if (!token) {
      return;
    }

    let isCancelled = false;

    const verifyEmail = async () => {
      try {
        const response = await apiFetch(API("/api/v1/users/verify-email"), {
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
  }, [isPreview, token]);

  return (
    <BWAuthShell
      title="Verify your email"
      subtitle="Confirm your email to finish setting up your account."
    >
      <div className={styles.body}>
        <Notice tone={NOTICE_TONE[state]} role={state === "error" ? "alert" : "status"}>
          {message}
        </Notice>
        <Link
          href={state === "success" ? "/login?verified=success" : "/login"}
          className={buttonClassName({ variant: "primary", fullWidth: true })}
        >
          Continue to log in
        </Link>
      </div>
    </BWAuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
