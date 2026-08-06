"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, Image as ImageIcon, Info, Link2, Share2 } from "lucide-react";
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

function readColorToken(token: string): string {
  return window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
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
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [posterPreviewUrl, setPosterPreviewUrl] = useState("");
  const [posterPreviewError, setPosterPreviewError] = useState("");
  const [exportingMode, setExportingMode] = useState<PosterMode | null>(null);
  const [qrColors, setQrColors] = useState<{ background: string; foreground: string } | null>(null);
  const qrImageSize = 620;
  const qrRenderSize = qrImageSize;

  const slug = slugify(tournamentName);
  const publicUrl = providedPublicUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/view/${slug}`
    : `/view/${slug}`);
  useEffect(() => {
    setQrColors({
      background: readColorToken("--color-text-primary"),
      foreground: readColorToken("--color-black"),
    });
  }, []);

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

      const qrCanvas = qrCanvasRef.current;
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
      } else {
        setPosterPreviewError("The QR canvas did not become ready.");
      }
    };

    setQrDataUrl("");
    setPosterPreviewUrl("");
    setPosterPreviewError("");
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

  const handleExportPng = async (mode: PosterMode, shouldDownload = true) => {
    if (shouldDownload && exportingMode) return;

    if (!qrDataUrl) {
      addToast({ type: "error", message: "Could not generate QR image.", duration: 3000 });
      return;
    }

    const W = 1080;
    const H = 1620;
    if (shouldDownload) {
      setExportingMode(mode);
    } else {
      setPosterPreviewError("");
    }

    const isPrintMode = mode === "print";
    const color = readColorToken;
    const palette = {
      pageBg: color(isPrintMode ? "--color-text-primary" : "--color-bg-primary"),
      shellBorder: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      shellGradientStart: color(isPrintMode ? "--color-text-primary" : "--color-surface-primary"),
      shellGradientMid: color(isPrintMode ? "--color-gray-50" : "--color-surface-primary"),
      shellGradientEnd: color(isPrintMode ? "--color-gray-100" : "--color-surface-primary"),
      headerGradientStart: color(isPrintMode ? "--color-text-primary" : "--color-surface-primary"),
      headerGradientEnd: color(isPrintMode ? "--color-gray-50" : "--color-surface-primary"),
      headerDivider: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      accentBg: color(isPrintMode ? "--color-gray-100" : "--color-surface-secondary"),
      accentBorder: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      accentText: color("--color-primary"),
      titleText: color(isPrintMode ? "--color-surface-primary" : "--color-text-primary"),
      bodyText: color(isPrintMode ? "--color-text-disabled" : "--color-text-secondary"),
      metaLabel: color(isPrintMode ? "--color-text-muted" : "--color-text-secondary"),
      sectionBg: color(isPrintMode ? "--color-gray-100" : "--color-surface-secondary"),
      sectionDivider: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      sectionLabel: color("--color-primary"),
      mainBg: color(isPrintMode ? "--color-text-primary" : "--color-bg-secondary"),
      qrOuterStart: color(isPrintMode ? "--color-gray-100" : "--color-surface-secondary"),
      qrOuterEnd: color(isPrintMode ? "--color-gray-200" : "--color-surface-secondary"),
      qrOuterBorder: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      calloutStrong: color(isPrintMode ? "--color-surface-primary" : "--color-text-primary"),
      calloutSoft: color(isPrintMode ? "--color-text-disabled" : "--color-text-secondary"),
      footerBg: color(isPrintMode ? "--color-gray-100" : "--color-bg-secondary"),
      footerDivider: color(isPrintMode ? "--color-gray-300" : "--color-border-primary"),
      footerStrong: color("--color-primary"),
      footerText: color(isPrintMode ? "--color-text-disabled" : "--color-text-secondary"),
    };

    try {
      const exportScale = mode === "print" ? 2 : 1;
      const canvas = document.createElement("canvas");
      canvas.width = W * exportScale;
      canvas.height = H * exportScale;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create export canvas.");
      ctx.scale(exportScale, exportScale);

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

      const loadImage = (src: string, timeoutMs = 5000) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const timeoutId = window.setTimeout(() => {
          img.src = "";
          reject(new Error("Image loading timed out."));
        }, timeoutMs);
        img.onload = () => {
          window.clearTimeout(timeoutId);
          resolve(img);
        };
        img.onerror = () => {
          window.clearTimeout(timeoutId);
          reject(new Error("Could not load poster image asset."));
        };
        img.src = src;
      });

      const qrImage = await loadImage(qrDataUrl);
      let logoImage: HTMLImageElement | null = null;
      try {
        logoImage = await loadImage("/logo_no_text.svg", 1500);
      } catch {
        // The poster remains usable if the decorative logo cannot be decoded.
      }

      const displayUrl = publicUrl.replace(/^https?:\/\//i, "");
      const [displayHost = "", ...displayPathParts] = displayUrl.split("/");
      const displayPath = displayPathParts.length ? `/${displayPathParts.join("/")}` : "";
      const orange = palette.accentText;
      const shellX = 28;
      const shellY = 28;
      const shellW = W - 56;
      const shellH = H - 56;

      ctx.fillStyle = palette.pageBg;
      ctx.fillRect(0, 0, W, H);
      roundRect(shellX, shellY, shellW, shellH, 30);
      ctx.fillStyle = color(isPrintMode ? "--color-text-primary" : "--color-bg-primary");
      ctx.fill();
      ctx.strokeStyle = palette.shellBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      roundRect(shellX, shellY, shellW, shellH, 30);
      ctx.clip();

      ctx.strokeStyle = orange;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(58, 104);
      ctx.lineTo(245, 104);
      ctx.moveTo(835, 104);
      ctx.lineTo(1022, 104);
      ctx.stroke();

      if (logoImage) {
        ctx.drawImage(logoImage, 274, 54, 100, 100);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = palette.titleText;
      ctx.font = '800 42px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("BRACKETWORKS", 395, 119);
      const brandWidth = ctx.measureText("BRACKETWORKS").width;
      ctx.fillStyle = orange;
      ctx.fillText(" LIVE", 395 + brandWidth, 119);

      ctx.textAlign = "center";
      ctx.fillStyle = palette.titleText;
      ctx.font = '900 92px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("SCAN FOR", W / 2, 270);
      ctx.fillStyle = orange;
      ctx.font = '900 104px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("LIVE RESULTS", W / 2, 378);

      ctx.strokeStyle = orange;
      ctx.beginPath();
      ctx.moveTo(92, 440);
      ctx.lineTo(500, 440);
      ctx.moveTo(580, 440);
      ctx.lineTo(988, 440);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, 440, 8, 0, Math.PI * 2);
      ctx.fillStyle = orange;
      ctx.fill();

      ctx.fillStyle = palette.titleText;
      ctx.font = '800 49px Inter, "Segoe UI", Arial, sans-serif';
      drawWrappedText(tournamentName || "Tournament", 920, 2, W / 2, 520, 55);

      const qrOuterSize = 674;
      const qrOuterX = Math.round((W - qrOuterSize) / 2);
      const qrOuterY = 608;
      roundRect(qrOuterX, qrOuterY, qrOuterSize, qrOuterSize, 28);
      ctx.fillStyle = color(isPrintMode ? "--color-gray-100" : "--color-surface-primary");
      ctx.fill();
      ctx.strokeStyle = orange;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.drawImage(qrImage, Math.round((W - qrImageSize) / 2), qrOuterY + 27, qrImageSize, qrImageSize);

      const calloutX = 218;
      const calloutY = 1310;
      const calloutW = 644;
      const calloutH = 92;
      roundRect(calloutX, calloutY, calloutW, calloutH, 14);
      ctx.fillStyle = color(isPrintMode ? "--color-gray-100" : "--color-surface-primary");
      ctx.fill();
      ctx.strokeStyle = palette.shellBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      const iconX = calloutX + 16;
      const iconY = calloutY + 17;
      roundRect(iconX, iconY, 58, 58, 12);
      ctx.fillStyle = color(isPrintMode ? "--bw-poster-accent-soft" : "--bw-poster-accent-muted");
      ctx.fill();
      ctx.strokeStyle = color("--bw-poster-accent-border");
      ctx.stroke();
      roundRect(iconX + 13, iconY + 17, 32, 24, 5);
      ctx.strokeStyle = orange;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(iconX + 29, iconY + 29, 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = palette.titleText;
      ctx.font = '800 28px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("Scan with your phone camera", calloutX + 92, calloutY + 39);
      ctx.fillStyle = palette.bodyText;
      ctx.font = '500 18px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("Open the live board instantly · No login required", calloutX + 92, calloutY + 67);

      ctx.strokeStyle = orange;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(58, 1445);
      ctx.lineTo(1022, 1445);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.font = '700 29px Inter, "Segoe UI", Arial, sans-serif';
      const fullUrlWidth = ctx.measureText(`${displayHost}${displayPath}`).width;
      const hostWidth = ctx.measureText(displayHost).width;
      const urlX = (W - fullUrlWidth) / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = orange;
      ctx.fillText(displayHost, urlX, 1500);
      ctx.fillStyle = palette.titleText;
      ctx.fillText(displayPath, urlX + hostWidth, 1500);

      ctx.textAlign = "center";
      ctx.fillStyle = palette.bodyText;
      ctx.font = '700 18px Inter, "Segoe UI", Arial, sans-serif';
      ctx.fillText("LIVE BRACKETS   •   ENTRIES   •   STANDINGS", W / 2, 1550);

      ctx.restore();
      roundRect(shellX, shellY, shellW, shellH, 30);
      ctx.strokeStyle = palette.shellBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (!shouldDownload) {
        setPosterPreviewUrl(canvas.toDataURL("image/png"));
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not generate PNG file.");

      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${slug}-live-poster-${mode}.png`;
      link.href = pngUrl;
      link.click();
      URL.revokeObjectURL(pngUrl);
    } catch (err) {
      if (!shouldDownload) {
        setPosterPreviewError(err instanceof Error ? err.message : "Failed to generate poster preview.");
      }
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to export poster.",
        duration: 3000,
      });
    } finally {
      if (shouldDownload) setExportingMode(null);
    }
  };

  useEffect(() => {
    if (!open || !qrDataUrl) return;
    void handleExportPng("social", false);
    // The QR data URL changes whenever the tournament-specific poster inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qrDataUrl]);

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
            <div className={styles.sectionHeading}><ImageIcon aria-hidden="true" /><span>Poster Preview</span></div>
            <div className={styles.previewCard}>
              <div className={styles.posterPreview}>
                {posterPreviewUrl
                  ? <NextImage className={styles.posterImage} src={posterPreviewUrl} alt={`Live results poster for ${tournamentName}`} width={1080} height={1620} unoptimized />
                  : posterPreviewError
                    ? (
                      <span className={styles.posterLoading}>
                        <strong>Poster preview unavailable</strong>
                        <small>{posterPreviewError}</small>
                        <button type="button" onClick={() => { void handleExportPng("social", false); }}>Retry</button>
                      </span>
                    )
                    : <span className={styles.posterLoading}>Generating poster…</span>}
              </div>
            </div>
          </div>

          <div className={styles.sharePanel}>
            <div className={styles.panelSectionHeading}>
              <Link2 aria-hidden="true" />
              <div>
                <p className={styles.shareTitle}>Share live link</p>
                <p className={styles.shareDescription}>Anyone with this link can follow the tournament. No account is required.</p>
              </div>
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
              <div className={styles.panelSectionHeading}>
                <Download aria-hidden="true" />
                <div>
                  <p className={styles.shareTitle}>Download poster</p>
                  <p className={styles.shareDescription}>Use these images to share the live results.</p>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  className={`${styles.exportBtn} ${styles.outlinedPanel}`}
                  onClick={() => { void handleExportPng("social"); }}
                  disabled={Boolean(exportingMode)}
                  aria-busy={exportingMode === "social"}
                >
                  <Download aria-hidden="true" />
                  <span>
                    <strong>{exportingMode === "social" ? "Exporting..." : "Social PNG"}</strong>
                    <small>1080 × 1620</small>
                  </span>
                </button>

                <button
                  className={`${styles.exportBtn} ${styles.outlinedPanel}`}
                  onClick={() => { void handleExportPng("print"); }}
                  disabled={Boolean(exportingMode)}
                  aria-busy={exportingMode === "print"}
                >
                  <Download aria-hidden="true" />
                  <span>
                    <strong>{exportingMode === "print" ? "Exporting..." : "Print PNG"}</strong>
                    <small>High-resolution</small>
                  </span>
                </button>
              </div>
            </div>

            <p className={`${styles.hint} ${styles.mutedMicrocopy}`}>
              <Info aria-hidden="true" />
              <span>Display the poster at check-in so bowlers can scan it from any device.</span>
            </p>
          </div>
        </div>

        <div className={styles.qrGenerator} aria-hidden="true">
          {qrColors && <QRCodeCanvas
            ref={qrCanvasRef}
            value={publicUrl}
            size={qrRenderSize}
            bgColor={qrColors.background}
            fgColor={qrColors.foreground}
            level="H"
            includeMargin
          />}
        </div>
      </div>
    </dialog>
  );
}
