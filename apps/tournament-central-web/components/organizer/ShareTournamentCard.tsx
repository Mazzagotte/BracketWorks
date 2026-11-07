'use client';

import { Button, Card, CardHeader, ICON_SIZE, Notice } from '@bracketworks/ui';
import { Download, Link2, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { organizerRoutes } from './organizerRoutes';
import styles from './ShareTournamentCard.module.css';

/** Pixel size the QR code is drawn at, so the downloaded image prints sharply. The card scales it down with CSS. */
const QR_RENDER_SIZE = 512;
// The library sets the drawn size inline; clearing it lets the stylesheet set the on-screen size.
const QR_DISPLAY_STYLE = { width: undefined, height: undefined };

type ShareTournamentCardProps = {
  tournamentId: number;
  tournamentName: string;
  dateText: string;
  locationText: string;
  isPublic: boolean;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

/** Share kit: the public registration link as a QR code, plus copy, download, and a printable flyer. */
export default function ShareTournamentCard({ tournamentId, tournamentName, dateText, locationText, isPublic }: ShareTournamentCardProps) {
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    setPublicUrl(new URL(organizerRoutes.publicPage(tournamentId), window.location.origin).toString());
  }, [tournamentId]);

  const qrDataUrl = () => qrWrapRef.current?.querySelector('canvas')?.toDataURL('image/png') ?? '';
  const fileSlug = tournamentName.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'tournament';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setMessage({ tone: 'success', text: 'Registration link copied.' });
    } catch {
      setMessage({ tone: 'danger', text: 'Unable to copy. Select the link and copy it instead.' });
    }
  };

  const downloadQr = () => {
    const dataUrl = qrDataUrl();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileSlug}-registration-qr.png`;
    link.click();
  };

  // A plain one-page flyer: name, date, place, the QR code, and the link, in black on white for any printer.
  const printFlyer = () => {
    const flyer = window.open('', '_blank', 'noopener=no');
    if (!flyer) {
      setMessage({ tone: 'danger', text: 'Allow pop-ups for this site to print the flyer.' });
      return;
    }
    flyer.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(tournamentName)}</title>
<style>body{font-family:Inter,Segoe UI,system-ui,sans-serif;text-align:center;margin:0;padding:48px 32px}
h1{font-size:32px;margin:0 0 12px}p{font-size:18px;margin:4px 0}img{width:320px;height:320px;margin:32px auto 16px;display:block}
.cta{font-size:22px;font-weight:700;margin-top:8px}.url{font-size:14px;word-break:break-all;margin-top:16px}</style></head>
<body><h1>${escapeHtml(tournamentName)}</h1><p>${escapeHtml(dateText)}</p><p>${escapeHtml(locationText)}</p>
<img src="${qrDataUrl()}" alt="QR code for registration"><p class="cta">Scan to register</p><p class="url">${escapeHtml(publicUrl)}</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
    flyer.document.close();
  };

  return (
    <Card aria-label="Share">
      <CardHeader title="Share" description="Post this at the bowling center or send the link to bowlers." />
      {isPublic ? (
        <div className={styles.body}>
          <div ref={qrWrapRef} className={styles.qr}>
            {publicUrl ? <QRCodeCanvas value={publicUrl} size={QR_RENDER_SIZE} marginSize={2} style={QR_DISPLAY_STYLE} title={`QR code for ${tournamentName} registration`} /> : null}
          </div>
          <p className={styles.url}>{publicUrl}</p>
          {message ? <Notice tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</Notice> : null}
          <div className={styles.actions}>
            <Button variant="secondary" icon={<Link2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void copyLink(); }}>Copy link</Button>
            <Button variant="ghost" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} onClick={downloadQr}>Download QR code</Button>
            <Button variant="ghost" icon={<Printer size={ICON_SIZE.md} aria-hidden="true" />} onClick={printFlyer}>Print flyer</Button>
          </div>
        </div>
      ) : (
        <p className={styles.helper}>Publish the tournament with public visibility to get a link and QR code bowlers can use to register.</p>
      )}
    </Card>
  );
}
