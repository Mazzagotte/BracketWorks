"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, QrCode, Share2 } from "lucide-react";
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

type PosterMode = "social" | "print";

function readRootCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ShareQRModal({
  open,
  onClose,
  tournamentId: _tournamentId,
  tournamentName,
  publicUrl: providedPublicUrl,
}: ShareQRModalProps) {
  const { addToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [exportingMode, setExportingMode] = useState<PosterMode | null>(null);
  const qrImageSize = 498;
  const qrRenderSize = qrImageSize;
  const qrBadgeSize = 180;
  const qrLogoSize = 176;

  const slug = slugify(tournamentName);
  const publicUrl = providedPublicUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/view/${slug}`
    : `/view/${slug}`);
  const generatedDate = new Date().toLocaleDateString();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

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
        try {
          setQrDataUrl(qrCanvas.toDataURL("image/png"));
          return;
        } catch {
          // Canvas may not be ready yet; retry until maxAttempts.
        }
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
    const safeDate = escapeHtml(generatedDate);
    const safeQrSrc = escapeHtml(qrImageSrc);

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:1080px;height:1350px;background:#0d1218;color:#e8edf3;font-family:'Segoe UI',Inter,Arial,sans-serif;box-sizing:border-box;padding:56px;">
        <div style="height:100%;border:1px solid #2a3342;border-radius:34px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(170deg,#111925 0%,#0e141d 55%,#0b1017 100%);box-shadow:0 30px 70px rgba(0,0,0,0.38);">
          <header style="padding:44px 50px 28px;border-bottom:1px solid #283243;display:flex;justify-content:space-between;gap:30px;align-items:flex-start;background:linear-gradient(180deg,rgba(255,122,0,0.14) 0%,rgba(255,122,0,0.03) 100%);">
            <div>
              <div style="display:inline-block;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,122,0,0.45);background:rgba(255,122,0,0.18);color:#ffd7b1;font-size:16px;font-weight:800;letter-spacing:0.7px;text-transform:uppercase;">BracketWorks Live</div>
              <div style="margin-top:16px;color:#ffffff;font-size:50px;font-weight:900;letter-spacing:0.2px;line-height:1;">Scan For Live Results</div>
              <div style="margin-top:8px;color:#aab6c7;font-size:20px;font-weight:600;">Real-time brackets, entries, and standings</div>
            </div>
            <div style="text-align:right;color:#9fb0c6;font-size:18px;line-height:1.35;padding-top:2px;">
              <div style="font-size:16px;font-weight:700;color:#d9e3ef;text-transform:uppercase;letter-spacing:1px;">Generated</div>
              <div style="margin-top:4px;font-size:26px;font-weight:800;color:#ffffff;">${safeDate}</div>
            </div>
          </header>

          <section style="padding:34px 50px 30px;border-bottom:1px solid #222d3d;background:rgba(255,255,255,0.02);">
            <div style="font-size:15px;font-weight:800;color:#8ea2bb;text-transform:uppercase;letter-spacing:1.1px;">Featured Tournament</div>
            <h1 style="margin:12px 0 0;font-size:58px;line-height:1.03;font-weight:900;letter-spacing:0;color:#ffffff;">${safeTournamentName}</h1>
          </section>

          <section style="padding:42px 50px 30px;display:flex;flex-direction:column;align-items:center;gap:26px;flex:1;">
            <div style="width:596px;height:596px;border:0.75px solid rgba(45,57,74,0.65);border-radius:28px;display:flex;align-items:center;justify-content:center;background:linear-gradient(165deg,#121b27 0%,#111827 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.02);">
              <div style="width:534px;height:534px;border-radius:18px;background:#ffffff;display:flex;align-items:center;justify-content:center;position:relative;">
                <img src="${safeQrSrc}" alt="" style="display:block;width:${qrImageSize}px;height:${qrImageSize}px;" />
                <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${qrBadgeSize}px;height:${qrBadgeSize}px;border-radius:28px;background:#ffffff;display:flex;align-items:center;justify-content:center;">
                  <img src="/logo_no_text.svg" alt="" style="display:block;width:${qrLogoSize}px;height:${qrLogoSize}px;" />
                </div>
              </div>
            </div>

            <div style="font-size:24px;line-height:1.3;color:#d6deea;text-align:center;font-weight:700;max-width:840px;">
              Use your phone camera to open the live board instantly.
            </div>

            <div style="font-size:18px;line-height:1.35;color:#9fb2c8;text-align:center;max-width:840px;">
              If scanning is unavailable, open <strong style="color:#ffffff;">bracketworks.app/view</strong> in your browser.
            </div>
          </section>

          <footer style="padding:24px 50px;border-top:1px solid #283447;color:#9db0c6;font-size:19px;line-height:1.35;display:flex;justify-content:space-between;gap:30px;background:rgba(0,0,0,0.16);">
            <strong style="color:#ffffff;font-size:21px;">bracketworks.app</strong>
            <span style="text-align:right;max-width:640px;">No login required. Share this code at check-in so bowlers can follow every update.</span>
          </footer>
        </div>
      </div>
    `;
  }, [generatedDate, tournamentName]);

  const handleExportPng = async (mode: PosterMode) => {
    if (exportingMode) return;

    if (!qrDataUrl) {
      addToast({ type: "error", message: "Could not generate QR image.", duration: 3000 });
      return;
    }

    const W = 1080;
    const H = 1350;
    setExportingMode(mode);

    const isPrintMode = mode === "print";
    const palette = {
      pageBg: isPrintMode ? "#ffffff" : "#0d1218",
      shellBorder: isPrintMode ? "#d6dee8" : "#2a3342",
      shellGradientStart: isPrintMode ? "#ffffff" : "#111925",
      shellGradientMid: isPrintMode ? "#f8fbff" : "#0e141d",
      shellGradientEnd: isPrintMode ? "#eef3f9" : "#0b1017",
      headerGradientStart: isPrintMode ? "rgba(255,122,0,0.12)" : "rgba(255,122,0,0.16)",
      headerGradientEnd: isPrintMode ? "rgba(255,122,0,0.02)" : "rgba(255,122,0,0.03)",
      headerDivider: isPrintMode ? "#d9e2ee" : "#283243",
      accentBg: isPrintMode ? "rgba(255,122,0,0.14)" : "rgba(255,122,0,0.18)",
      accentBorder: isPrintMode ? "rgba(255,122,0,0.45)" : "rgba(255,122,0,0.45)",
      accentText: isPrintMode ? "#8f4500" : "#ffd7b1",
      titleText: isPrintMode ? "#0f172a" : "#ffffff",
      bodyText: isPrintMode ? "#334155" : "#aab6c7",
      metaLabel: isPrintMode ? "#475569" : "#d9e3ef",
      sectionBg: isPrintMode ? "rgba(15,23,42,0.02)" : "rgba(255,255,255,0.02)",
      sectionDivider: isPrintMode ? "#d9e3ee" : "#222d3d",
      sectionLabel: isPrintMode ? "#64748b" : "#8ea2bb",
      qrOuterStart: isPrintMode ? "#f3f6fb" : "#121b27",
      qrOuterEnd: isPrintMode ? "#eef2f7" : "#111827",
      qrOuterBorder: isPrintMode ? "#cfd8e4" : "#2d394a",
      calloutStrong: isPrintMode ? "#1e293b" : "#d6deea",
      calloutSoft: isPrintMode ? "#475569" : "#9fb2c8",
      footerBg: isPrintMode ? "rgba(15,23,42,0.04)" : "rgba(0,0,0,0.16)",
      footerDivider: isPrintMode ? "#d0d9e5" : "#283447",
      footerStrong: isPrintMode ? "#0f172a" : "#ffffff",
      footerText: isPrintMode ? "#475569" : "#9db0c6",
    };

    try {
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create export canvas.");
      ctx.scale(2, 2);

      const roundRect = (x: number, y: number, width: number, height: number, radius: number) => {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
      };

      const drawWrappedText = (
        text: string,
        maxWidth: number,
        maxLines: number,
        x: number,
        y: number,
        lineHeight: number,
      ) => {
        const words = text.trim().split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = "";

        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
            continue;
          }

          if (current) {
            lines.push(current);
            current = word;
          } else {
            lines.push(word);
            current = "";
          }

          if (lines.length >= maxLines) break;
        }

        if (lines.length < maxLines && current) lines.push(current);

        if (lines.length > maxLines) lines.length = maxLines;
        if (words.length && lines.length === maxLines) {
          const builtWords = lines.join(" ").split(/\s+/).length;
          if (builtWords < words.length) {
            let last = lines[maxLines - 1] || "";
            while (last.length > 0 && ctx.measureText(`${last}...`).width > maxWidth) {
              last = last.slice(0, -1).trimEnd();
            }
            lines[maxLines - 1] = `${last}...`;
          }
        }

        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + index * lineHeight);
        });
      };

      ctx.fillStyle = palette.pageBg;
      ctx.fillRect(0, 0, W, H);

      const shellX = 56;
      const shellY = 56;
      const shellW = W - 112;
      const shellH = H - 112;
      const shellGradient = ctx.createLinearGradient(shellX, shellY, shellX + shellW, shellY + shellH);
      shellGradient.addColorStop(0, palette.shellGradientStart);
      shellGradient.addColorStop(0.55, palette.shellGradientMid);
      shellGradient.addColorStop(1, palette.shellGradientEnd);
      roundRect(shellX, shellY, shellW, shellH, 34);
      ctx.fillStyle = shellGradient;
      ctx.fill();
      ctx.strokeStyle = palette.shellBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      const headerH = 226;
      const headerGradient = ctx.createLinearGradient(shellX, shellY, shellX, shellY + headerH);
      headerGradient.addColorStop(0, palette.headerGradientStart);
      headerGradient.addColorStop(1, palette.headerGradientEnd);
      roundRect(shellX, shellY, shellW, headerH, 34);
      ctx.fillStyle = headerGradient;
      ctx.fill();

      ctx.strokeStyle = palette.headerDivider;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shellX, shellY + headerH);
      ctx.lineTo(shellX + shellW, shellY + headerH);
      ctx.stroke();

      roundRect(shellX + 50, shellY + 32, 252, 36, 18);
      ctx.fillStyle = palette.accentBg;
      ctx.fill();
      ctx.strokeStyle = palette.accentBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = palette.accentText;
      ctx.font = '800 16px "Segoe UI", Inter, Arial, sans-serif';
      ctx.textAlign = "left";
      ctx.fillText("BRACKETWORKS LIVE", shellX + 65, shellY + 57);

      ctx.fillStyle = palette.titleText;
      ctx.font = '900 48px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("Scan For Live Results", shellX + 50, shellY + 118);

      ctx.fillStyle = palette.bodyText;
      ctx.font = '600 20px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("Real-time brackets, entries, and standings", shellX + 50, shellY + 154);

      ctx.textAlign = "right";
      ctx.fillStyle = palette.metaLabel;
      ctx.font = '700 16px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("GENERATED", shellX + shellW - 50, shellY + 52);
      ctx.fillStyle = palette.titleText;
      ctx.font = '800 26px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText(generatedDate, shellX + shellW - 50, shellY + 86);

      const tournamentY = shellY + headerH;
      const tournamentH = 184;
      ctx.fillStyle = palette.sectionBg;
      ctx.fillRect(shellX, tournamentY, shellW, tournamentH);
      ctx.strokeStyle = palette.sectionDivider;
      ctx.beginPath();
      ctx.moveTo(shellX, tournamentY + tournamentH);
      ctx.lineTo(shellX + shellW, tournamentY + tournamentH);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = palette.sectionLabel;
      ctx.font = '800 15px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("FEATURED TOURNAMENT", shellX + 50, tournamentY + 48);

      ctx.fillStyle = palette.titleText;
      ctx.font = '900 58px "Segoe UI", Inter, Arial, sans-serif';
      drawWrappedText(tournamentName || "Tournament", shellW - 100, 2, shellX + 50, tournamentY + 114, 62);

      const qrOuterSize = 596;
      const qrOuterX = Math.round((W - qrOuterSize) / 2);
      const qrOuterY = tournamentY + tournamentH + 42;
      const qrGradient = ctx.createLinearGradient(qrOuterX, qrOuterY, qrOuterX, qrOuterY + qrOuterSize);
      qrGradient.addColorStop(0, palette.qrOuterStart);
      qrGradient.addColorStop(1, palette.qrOuterEnd);
      roundRect(qrOuterX, qrOuterY, qrOuterSize, qrOuterSize, 28);
      ctx.fillStyle = qrGradient;
      ctx.fill();
      ctx.strokeStyle = palette.qrOuterBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      const qrInnerSize = 534;
      const qrInnerX = Math.round((W - qrInnerSize) / 2);
      const qrInnerY = qrOuterY + Math.round((qrOuterSize - qrInnerSize) / 2);
      roundRect(qrInnerX, qrInnerY, qrInnerSize, qrInnerSize, 18);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not render QR image."));
        img.src = qrDataUrl;
      });

      const qrImageX = Math.round((W - qrImageSize) / 2);
      const qrImageY = qrInnerY + Math.round((qrInnerSize - qrImageSize) / 2);
      ctx.drawImage(qrImage, qrImageX, qrImageY, qrImageSize, qrImageSize);

      // Explicit overlay keeps the logo visibly centered in the poster output.
      try {
        const logoImage = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Logo image failed to load."));
          img.src = "/logo_no_text.svg";
        });

        const logoBadgeX = Math.round(W / 2 - qrBadgeSize / 2);
        const logoBadgeY = Math.round(qrImageY + qrImageSize / 2 - qrBadgeSize / 2);
        const logoBadgeRadius = 28;
        roundRect(logoBadgeX, logoBadgeY, qrBadgeSize, qrBadgeSize, logoBadgeRadius);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        const logoX = Math.round(W / 2 - qrLogoSize / 2);
        const logoY = Math.round(qrImageY + qrImageSize / 2 - qrLogoSize / 2);
        ctx.drawImage(logoImage, logoX, logoY, qrLogoSize, qrLogoSize);
      } catch {
        // Keep export resilient if logo cannot be loaded.
      }

      const footerH = 106;
      const footerY = shellY + shellH - footerH;
      const primaryCalloutY = footerY - 38;
      const secondaryCalloutY = footerY - 10;

      ctx.textAlign = "center";
      ctx.fillStyle = palette.calloutStrong;
      ctx.font = '700 24px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("Use your phone camera to open the live board instantly.", W / 2, primaryCalloutY);

      ctx.fillStyle = palette.calloutSoft;
      ctx.font = '600 19px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("If scanning is unavailable, open bracketworks.app/view in your browser.", W / 2, secondaryCalloutY);

      ctx.fillStyle = palette.footerBg;
      ctx.fillRect(shellX, footerY, shellW, footerH);
      ctx.strokeStyle = palette.footerDivider;
      ctx.beginPath();
      ctx.moveTo(shellX, footerY);
      ctx.lineTo(shellX + shellW, footerY);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = palette.footerStrong;
      ctx.font = '700 21px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("bracketworks.app", shellX + 50, footerY + 66);

      ctx.textAlign = "right";
      ctx.fillStyle = palette.footerText;
      ctx.font = '600 18px "Segoe UI", Inter, Arial, sans-serif';
      ctx.fillText("No login required. Share this code at check-in so bowlers can follow every update.", shellX + shellW - 50, footerY + 66);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not generate PNG file.");

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${slug}-live-poster-${mode}.png`;
      link.href = pngUrl;
      link.click();
      URL.revokeObjectURL(pngUrl);
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to export poster.",
        duration: 3000,
      });
    } finally {
      setExportingMode(null);
    }
  };

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true"><Share2 /></span>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Share Live View</h2>
            <p className={styles.tournamentName}>Share live brackets, scores, and standings for {tournamentName}.</p>
          </div>
          <CloseControl onClick={onClose} size="sm" />
        </div>

        <div className={styles.bodyGrid}>
          <div className={styles.qrSection}>
            <div className={styles.sectionHeading}><QrCode aria-hidden="true" /><span>Live Poster Preview</span></div>
            <div className={styles.posterPreview}>
              <div
                className={styles.posterFrame}
                aria-label="QR poster preview"
                dangerouslySetInnerHTML={{
                  __html: buildPosterHtml(qrDataUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
                }}
              />
            </div>
            <p className={`${styles.qrLabel} ${styles.mutedMicrocopy}`}>Scan to open the public live board</p>
          </div>

          <div className={styles.sharePanel}>
            <div>
              <p className={styles.shareTitle}>Share the live link</p>
              <p className={styles.shareDescription}>Anyone with this link can follow the tournament. No account is required.</p>
            </div>

            <div className={`${styles.urlRow} ${styles.outlinedPanel}`}>
              <span className={`${styles.urlText} ${styles.mutedMicrocopy}`}>{publicUrl}</span>
              <button
                className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ""}`}
                onClick={handleCopy}
              >
                {copied ? <><Check aria-hidden="true" />Copied!</> : <><Copy aria-hidden="true" />Copy Link</>}
              </button>
            </div>

            <div className={styles.exportSection}>
              <p className={styles.exportLabel}>Download poster</p>
              <div className={styles.actions}>
                <button
                  className={`${styles.exportBtn} ${styles.outlinedPanel}`}
                  onClick={() => { void handleExportPng("social"); }}
                  disabled={Boolean(exportingMode)}
                  aria-busy={exportingMode === "social"}
                >
                  <Download aria-hidden="true" />
                  {exportingMode === "social" ? "Exporting..." : "Social PNG"}
                </button>

                <button
                  className={`${styles.exportBtn} ${styles.outlinedPanel}`}
                  onClick={() => { void handleExportPng("print"); }}
                  disabled={Boolean(exportingMode)}
                  aria-busy={exportingMode === "print"}
                >
                  <Download aria-hidden="true" />
                  {exportingMode === "print" ? "Exporting..." : "Print PNG"}
                </button>
              </div>
            </div>

            <p className={`${styles.hint} ${styles.mutedMicrocopy}`}>Display the poster at check-in so bowlers can scan it from any device.</p>
          </div>
        </div>

        <div ref={canvasRef} hidden>
          <QRCodeCanvas
            value={publicUrl}
            size={qrRenderSize}
            bgColor="#ffffff"
            fgColor="#111111"
            level="H"
            includeMargin
            imageSettings={{
              src: "/logo_no_text.svg",
              width: qrBadgeSize,
              height: qrBadgeSize,
              excavate: true,
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
