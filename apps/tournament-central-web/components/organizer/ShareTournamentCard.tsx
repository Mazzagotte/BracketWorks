'use client';

import { Button, CardDivider, ICON_SIZE, Modal, Notice } from '@bracketworks/ui';
import { Download, Link2, Printer, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { livePagePath } from '@/components/live/liveStandingsPaths';
import { organizerRoutes } from './organizerRoutes';
import styles from './ShareTournamentCard.module.css';

/** Pixel size the QR code is drawn at, so the downloaded image prints sharply. The dialog scales it down with CSS. */
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

/** Share kit: copy the registration and live standings links; the QR code and printable flyer open in a dialog. */
export default function ShareTournamentButton({ tournamentId, tournamentName, dateText, locationText, isPublic }: ShareTournamentCardProps) {
  const qrWrapRef = useRef<HTMLDivElement | null>(null);
  const [publicUrl, setPublicUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setPublicUrl(new URL(organizerRoutes.publicPage(tournamentId), window.location.origin).toString());
    setLiveUrl(new URL(livePagePath(tournamentId), window.location.origin).toString());
  }, [tournamentId]);

  const qrDataUrl = () => qrWrapRef.current?.querySelector('canvas')?.toDataURL('image/png') ?? '';
  const fileSlug = tournamentName.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'tournament';

  const copyLink = async (url = publicUrl, copiedText = 'Registration link copied.') => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ tone: 'success', text: copiedText });
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

  const open = () => { setMessage(null); setIsOpen(true); };
  const close = () => { setMessage(null); setIsOpen(false); };

  return (
    <>
      <Button variant="secondary" icon={<Share2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={open}>Share</Button>
      <Modal
        open={isOpen}
        onClose={close}
        size="sm"
        title="Share this tournament"
        description="Post this at the bowling center or send the links to bowlers."
        closeLabel="Close share"
        footer={isPublic ? (
          <>
            <Button variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} onClick={downloadQr}>Download QR code</Button>
            <Button variant="secondary" icon={<Printer size={ICON_SIZE.md} aria-hidden="true" />} onClick={printFlyer}>Print flyer</Button>
          </>
        ) : undefined}
      >
        {isPublic ? (
          <div className={styles.body}>
            <div className={styles.linkGroup}>
              <h3 className={styles.linkTitle}>Registration link</h3>
              <p className={styles.url}>{publicUrl}</p>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" icon={<Link2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void copyLink(); }}>Copy link</Button>
            </div>
            <div className={styles.linkGroup}>
              <h3 className={styles.linkTitle}>Live standings link</h3>
              <p className={styles.url}>{liveUrl}</p>
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" icon={<Link2 size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => { void copyLink(liveUrl, 'Live standings link copied.'); }}>
                Copy live standings link
              </Button>
            </div>
            {message ? <Notice tone={message.tone} role={message.tone === 'danger' ? 'alert' : 'status'}>{message.text}</Notice> : null}
            <CardDivider />
            <div className={styles.linkGroup}>
              <h3 className={styles.linkTitle}>QR code</h3>
              <p className={styles.url}>Bowlers scan the code to open the registration page.</p>
            </div>
            <div ref={qrWrapRef} className={styles.qr}>
              {publicUrl ? <QRCodeCanvas value={publicUrl} size={QR_RENDER_SIZE} marginSize={2} style={QR_DISPLAY_STYLE} title={`QR code for ${tournamentName} registration`} /> : null}
            </div>
          </div>
        ) : (
          <p className={styles.helper}>Publish the tournament with public visibility to get a link and QR code bowlers can use to register.</p>
        )}
      </Modal>
    </>
  );
}
