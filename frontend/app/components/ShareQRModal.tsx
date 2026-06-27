"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useToast } from "./Toast";
import CloseControl from "../../components/CloseControl";
import styles from "./ShareQRModal.module.css";

interface ShareQRModalProps {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
  tournamentName: string;
  publicUrl?: string;
}

function readRootCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ShareQRModal({ open, onClose, tournamentId, tournamentName, publicUrl: providedPublicUrl }: ShareQRModalProps) {
  const { addToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const slug = slugify(tournamentName);
  const publicUrl = providedPublicUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/view/${slug}`
    : `/view/${slug}`);
  const qrBackgroundColor = typeof window !== "undefined" ? readRootCssVar("--share-qr-code-bg") : "";
  const qrForegroundColor = typeof window !== "undefined" ? readRootCssVar("--share-qr-code-fg") : "";
  const generatedDate = new Date().toLocaleDateString();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast({ type: "success", message: "Link copied!", duration: 2500 });
    } catch {
      addToast({ type: "error", message: "Failed to copy link.", duration: 3000 });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  const buildPosterHtml = useCallback((qrImageSrc: string) => {
    const safeTournamentName = escapeHtml(tournamentName);
    const safePublicUrl = escapeHtml(publicUrl);
    const safeDate = escapeHtml(generatedDate);
    const safeQrSrc = escapeHtml(qrImageSrc);

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:1080px;height:1350px;background:#ffffff;color:#111827;font-family:Inter,Arial,sans-serif;box-sizing:border-box;padding:64px;">
        <div style="height:100%;border:1px solid #d6dae1;border-left:12px solid #ff7a00;border-radius:32px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;">
          <header style="padding:48px 54px 34px;border-bottom:4px solid #ff7a00;display:flex;justify-content:space-between;gap:40px;align-items:flex-start;">
            <div>
              <div style="color:#ff7a00;font-size:38px;font-weight:900;letter-spacing:0;">BracketWorks</div>
              <div style="margin-top:10px;color:#4b5563;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:1.4px;">Live Tournament Board</div>
            </div>
            <div style="text-align:right;color:#4b5563;font-size:18px;line-height:1.35;padding-top:4px;">
              <div style="font-size:24px;font-weight:900;color:#111827;">Scan to view</div>
              <div>Generated ${safeDate}</div>
            </div>
          </header>
          <section style="padding:48px 54px 42px;background:#f7f8fa;border-bottom:1px solid #d6dae1;">
            <div style="font-size:18px;font-weight:900;color:#4b5563;text-transform:uppercase;letter-spacing:1.4px;">Tournament</div>
            <h1 style="margin:14px 0 0;font-size:64px;line-height:1.02;font-weight:900;letter-spacing:0;color:#111827;">${safeTournamentName}</h1>
          </section>
          <section style="padding:52px 54px 38px;display:flex;flex-direction:column;align-items:center;gap:34px;flex:1;">
            <div style="width:620px;height:620px;border:1px solid #d6dae1;border-left:10px solid #ff7a00;border-radius:30px;display:flex;align-items:center;justify-content:center;background:#ffffff;">
              <img src="${safeQrSrc}" alt="" style="display:block;width:500px;height:500px;" />
            </div>
            <div style="width:100%;border:1px solid #d6dae1;border-left:10px solid #ff7a00;border-radius:24px;padding:28px 32px;box-sizing:border-box;background:#ffffff;">
              <div style="font-size:17px;font-weight:900;color:#4b5563;text-transform:uppercase;letter-spacing:1.2px;">Live Link</div>
              <div style="margin-top:12px;font-size:27px;line-height:1.24;font-weight:800;color:#111827;word-break:break-all;">${safePublicUrl}</div>
            </div>
          </section>
          <footer style="padding:30px 54px;border-top:1px solid #d6dae1;color:#4b5563;font-size:20px;line-height:1.35;display:flex;justify-content:space-between;gap:30px;">
            <strong style="color:#111827;font-size:22px;">bracketworks.app</strong>
            <span style="text-align:right;">No login required. Bowlers can view live brackets and scores from any device.</span>
          </footer>
        </div>
      </div>
    `;
  }, [generatedDate, publicUrl, tournamentName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;
    const retryDelayMs = 50;

    const readQrCanvas = () => {
      if (cancelled) return;
      const qrCanvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      if (qrCanvas) {
        setQrDataUrl(qrCanvas.toDataURL("image/png"));
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(readQrCanvas, retryDelayMs);
      }
    };

    setQrDataUrl("");
    readQrCanvas();

    return () => {
      cancelled = true;
    };
  }, [open, publicUrl]);

  const handleExportPng = async () => {
    if (!qrDataUrl) {
      addToast({ type: "error", message: "Could not generate QR image.", duration: 3000 });
      return;
    }

    const W = 1080;
    const H = 1350;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <foreignObject width="100%" height="100%">${buildPosterHtml(qrDataUrl)}</foreignObject>
      </svg>
    `;
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not render poster image."));
      });
      img.src = svgUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create export canvas.");
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, W, H);

      const a = document.createElement("a");
      a.download = `${slug}-live-poster.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : "Failed to export poster.", duration: 3000 });
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleBackdropClick}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Share Live Bracket</h2>
            <p className={styles.tournamentName}>{tournamentName}</p>
          </div>
          <CloseControl onClick={onClose} size="sm" />
        </div>

        {/* QR Code */}
        <div className={styles.qrSection}>
          <div className={styles.posterPreview}>
            <div
              className={styles.posterFrame}
              aria-label="QR poster preview"
              dangerouslySetInnerHTML={{
                __html: buildPosterHtml(qrDataUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
              }}
            />
          </div>
          <p className={`${styles.qrLabel} ${styles.mutedMicrocopy}`}>Live poster preview</p>
        </div>

        {/* Divider */}
        <div className={`${styles.divider} ${styles.mutedMicrocopy}`}><span>or share the link</span></div>

        {/* URL row */}
        <div className={`${styles.urlRow} ${styles.outlinedPanel}`}>
          <span className={`${styles.urlText} ${styles.mutedMicrocopy}`}>{publicUrl}</span>
          <button
            className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ""}`}
            onClick={handleCopy}
          >
            {copied ? (
              <><svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={styles.iconInline}><path d="M1.5 7L5 10.5L11.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
            ) : "Copy link"}
          </button>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={`${styles.exportBtn} ${styles.outlinedPanel}`} onClick={handleExportPng}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={styles.iconNoShrink}>
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download PNG
          </button>
        </div>

        {/* Footer */}
        <p className={`${styles.hint} ${styles.mutedMicrocopy}`}>No login required - bowlers can view scores from any device.</p>

        {/* Hidden canvas used to produce the QR image for the HTML poster export */}
        <div ref={canvasRef} hidden>
          <QRCodeCanvas
            value={publicUrl}
            size={400}
            bgColor={qrBackgroundColor}
            fgColor={qrForegroundColor}
            level="H"
            imageSettings={{
              src: "/logo.svg",
              width: 116,
              height: 116,
              excavate: true,
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
