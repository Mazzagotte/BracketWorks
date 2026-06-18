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

const TEMPLATE_LAYOUT = {
  titleCenterXPct: 0.52,
  titleZoneTopPct: 0.08,
  titleZoneBottomPct: 0.19,
  titleMaxWidthPct: 0.7625,
  qrFrameXPct: 0.19,
  qrFrameYPct: 0.35,
  qrFrameSizePct: 0.61,
  qrPaddingPct: 0.06,
  titleMaxFontPx: 60,
  titleMinFontPx: 26
};

function readRootCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
  const [previewPosterSrc, setPreviewPosterSrc] = useState<string>("");
  const templateSrc = "/qr-poster-template.png";

  const slug = slugify(tournamentName);
  const publicUrl = providedPublicUrl || (typeof window !== "undefined"
    ? `${window.location.origin}/view/${slug}`
    : `/view/${slug}`);
  const qrBackgroundColor = typeof window !== "undefined" ? readRootCssVar("--share-qr-code-bg") : "";
  const qrForegroundColor = typeof window !== "undefined" ? readRootCssVar("--share-qr-code-fg") : "";

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

  const buildPosterCanvas = useCallback(async (qrCanvas: HTMLCanvasElement | null) => {
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

    let templateImage: HTMLImageElement;
    try {
      templateImage = await loadImage(templateSrc);
    } catch {
      addToast({ type: "error", message: "Template image not found: /qr-poster-template.png", duration: 3200 });
      return null;
    }

    const dpr = 2;
    const W = templateImage.naturalWidth;
    const H = templateImage.naturalHeight;

    const off = document.createElement("canvas");
    off.width = W * dpr;
    off.height = H * dpr;
    const ctx = off.getContext("2d");
    if (!ctx) {
      addToast({ type: "error", message: "Could not create export canvas.", duration: 3000 });
      return null;
    }
    ctx.scale(dpr, dpr);

    const posterFillColor = readRootCssVar("--share-qr-poster-fill");
    const posterShadowColor = readRootCssVar("--share-qr-title-shadow");
    const posterStrokeColor = readRootCssVar("--share-qr-title-stroke");

    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    const fitLineToWidth = (line: string, maxWidth: number) => {
      if (ctx.measureText(line).width <= maxWidth) return line;
      let out = line;
      while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) {
        out = out.slice(0, -1);
      }
      return `${out}...`;
    };

    // Base template
    ctx.drawImage(templateImage, 0, 0, W, H);

    // Tournament title overlay
    ctx.fillStyle = posterFillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 66px Inter, Arial, sans-serif";

    const titleCenterX = W * TEMPLATE_LAYOUT.titleCenterXPct;
    const titleZoneTop = H * TEMPLATE_LAYOUT.titleZoneTopPct;
    const titleZoneBottom = H * TEMPLATE_LAYOUT.titleZoneBottomPct;
    const titleMaxW = W * TEMPLATE_LAYOUT.titleMaxWidthPct;
    const zoneHeight = titleZoneBottom - titleZoneTop;

    const fitTitle = () => {
      const maxFontPx = TEMPLATE_LAYOUT.titleMaxFontPx;
      const minFontPx = TEMPLATE_LAYOUT.titleMinFontPx;
      let bestSize = minFontPx;
      let bestLines = wrapText(tournamentName, titleMaxW);
      let foundFit = false;

      // Deterministic fit pass so max/min constants are intuitive to tune.
      for (let size = maxFontPx; size >= minFontPx; size -= 1) {
        ctx.font = `800 ${size}px Inter, Arial, sans-serif`;
        const lines = wrapText(tournamentName, titleMaxW);
        const lineHeight = size * 1.1;
        const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 1);
        const fits = lines.length <= 2 && widest <= titleMaxW && lines.length * lineHeight <= zoneHeight;

        if (fits) {
          bestSize = size;
          bestLines = lines;
          foundFit = true;
          break;
        }
      }

      if (!foundFit) {
        ctx.font = `800 ${minFontPx}px Inter, Arial, sans-serif`;
        const minLines = wrapText(tournamentName, titleMaxW);
        if (minLines.length <= 2) {
          bestLines = minLines;
        } else {
          const first = minLines[0] ?? '';
          const secondRaw = minLines.slice(1).join(" ");
          const second = fitLineToWidth(secondRaw, titleMaxW);
          bestLines = [fitLineToWidth(first, titleMaxW), second];
        }
        bestSize = minFontPx;
      }

      return { size: Math.floor(bestSize), lines: bestLines };
    };

    const { size: fittedTitleSize, lines: fittedTitleLines } = fitTitle();
    const fittedLineHeight = fittedTitleSize * 1.1;
    const titleBlockH = fittedTitleLines.length * fittedLineHeight;
    const titleFirstBaselineY = titleZoneTop + (zoneHeight - titleBlockH) / 2 + fittedLineHeight * 0.9;

    ctx.font = `800 ${fittedTitleSize}px Inter, Arial, sans-serif`;
    ctx.shadowColor = posterShadowColor;
    ctx.shadowBlur = Math.max(2, fittedTitleSize * 0.14);
    ctx.shadowOffsetY = Math.max(1, fittedTitleSize * 0.05);
    ctx.strokeStyle = posterStrokeColor;
    ctx.lineWidth = Math.max(1, fittedTitleSize * 0.055);
    ctx.lineJoin = "round";
    fittedTitleLines.forEach((line, i) => {
      const y = titleFirstBaselineY + i * fittedLineHeight;
      ctx.strokeText(line, titleCenterX, y);
      ctx.fillText(line, titleCenterX, y);
    });
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // QR in template placeholder area (optional for preview-first render)
    if (qrCanvas) {
      const qrFrameX = W * TEMPLATE_LAYOUT.qrFrameXPct;
      const qrFrameY = H * TEMPLATE_LAYOUT.qrFrameYPct;
      const qrFrameSize = W * TEMPLATE_LAYOUT.qrFrameSizePct;
      const qrPadding = qrFrameSize * TEMPLATE_LAYOUT.qrPaddingPct;
      const qrDrawSize = qrFrameSize - qrPadding * 2;
      ctx.drawImage(qrCanvas, qrFrameX + qrPadding, qrFrameY + qrPadding, qrDrawSize, qrDrawSize);
    }

    return off;
  }, [addToast, templateSrc, tournamentName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;
    const retryDelayMs = 50;

    const renderPreview = async () => {
      if (cancelled) return;
      const qrCanvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      const posterCanvas = await buildPosterCanvas(qrCanvas);
      if (!cancelled && posterCanvas) {
        setPreviewPosterSrc(posterCanvas.toDataURL("image/png"));
      }

      if (!qrCanvas) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(() => {
            void renderPreview();
          }, retryDelayMs);
        }
      }
    };

    setPreviewPosterSrc("");
    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [buildPosterCanvas, open]);

  const handleExportPng = async () => {
    const qrCanvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!qrCanvas) {
      addToast({ type: "error", message: "Could not generate QR image.", duration: 3000 });
      return;
    }
    const posterCanvas = await buildPosterCanvas(qrCanvas);
    if (!posterCanvas) return;

    const a = document.createElement("a");
    a.download = `${slug}-qr.png`;
    a.href = posterCanvas.toDataURL("image/png");
    a.click();
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
            {/* eslint-disable-next-line @next/next/no-img-element -- preview uses generated data URL/fallback template outside next/image optimization */}
            <img
              src={previewPosterSrc || templateSrc}
              alt="QR poster preview"
              className={styles.posterImage}
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

        {/* Hidden canvas used for PDF export */}
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
