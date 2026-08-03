import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import content from './legal-content.json';
import styles from './legal.module.css';

export type LegalDocumentKey = keyof typeof content;

function sectionId(heading: string): string {
  return `section-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

function renderParagraphs(paragraphs: readonly string[]) {
  const output: ReactNode[] = [];
  let letteredItems: string[] = [];

  const flushLetteredItems = () => {
    if (!letteredItems.length) return;
    output.push(
      <ol className={styles.letteredList} type="a" key={`list-${output.length}`}>
        {letteredItems.map((item, index) => <li key={`${item}-${index}`}>{item.replace(/^[a-z]\.\s*/i, '')}</li>)}
      </ol>
    );
    letteredItems = [];
  };

  paragraphs.forEach((paragraph, index) => {
    if (/^[a-z]\.\s+/i.test(paragraph)) {
      letteredItems.push(paragraph);
      return;
    }
    flushLetteredItems();
    const isCapitalizedNotice = paragraph.length > 60
      && paragraph === paragraph.toUpperCase()
      && /[A-Z]/.test(paragraph);
    output.push(<p className={isCapitalizedNotice ? styles.capitalizedNotice : undefined} key={`${paragraph}-${index}`}>{paragraph}</p>);
  });
  flushLetteredItems();
  return output;
}

export default function LegalDocumentPage({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = content[documentKey];
  const effectiveDate = document.intro.find(paragraph => paragraph.startsWith('Effective Date:'))?.replace('Effective Date:', '').trim();
  const introParagraphs = document.intro.filter(paragraph => !paragraph.startsWith('Effective Date:') && !paragraph.startsWith('Draft Version:'));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="BracketWorks homepage">
          <Image src="/logo_no_text.svg" alt="" width={36} height={36} priority />
          <span><strong>BRACKET<span>WORKS</span></strong><small>Bowling Tournament Management</small></span>
        </Link>
        <div className={styles.headerRight}>
          <nav className={styles.primaryNav} aria-label="Public navigation">
            <Link href="/">Home</Link>
            <Link href="/view">Live View</Link>
          </nav>
          <div className={styles.accountActions}>
            <Link href="/login" className={styles.signIn}>Sign In</Link>
            <Link href="/signup" className={styles.createAccount}>Create Account</Link>
          </div>
        </div>
      </header>

      <nav className={styles.legalNav} aria-label="Legal documents">
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/operator-terms">Operator Terms</Link>
        <Link href="/acceptable-use">Acceptable Use</Link>
      </nav>

      <article className={styles.document}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>BracketWorks legal</p>
          <h1>{document.title}</h1>
          <div className={styles.documentMeta} aria-label="Document status">
            <span>Draft version {document.version}</span>
            <span>{effectiveDate && !effectiveDate.includes('[Insert') ? `Effective ${effectiveDate}` : 'Effective date pending'}</span>
          </div>
          <div className={styles.draftNotice} role="note">
            This document is a pre-publication draft. BracketWorks must confirm the remaining
            business and legal placeholders before these terms become effective.
          </div>
          {renderParagraphs(introParagraphs)}
        </div>

        <div className={styles.documentLayout}>
          <aside className={styles.contents} aria-label="Table of contents">
            <strong>In this document</strong>
            <nav>
              {document.sections.map(section => <a key={section.heading} href={`#${sectionId(section.heading)}`}>{section.heading}</a>)}
            </nav>
          </aside>
          <div className={styles.sections}>
            {document.sections.map(section => (
              <section id={sectionId(section.heading)} key={section.heading}>
                <h2>{section.heading}</h2>
                {renderParagraphs(section.paragraphs)}
              </section>
            ))}
          </div>
        </div>
      </article>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Image src="/logo_no_text.svg" alt="" width={30} height={30} />
          <div><strong>BRACKET<span>WORKS</span></strong><p>One organized workspace for bowling tournament management.</p></div>
        </div>
        <nav aria-label="Footer navigation">
          <div><strong>Product</strong><Link href="/">Homepage</Link><Link href="/view">Public Live View</Link></div>
          <div><strong>Account</strong><Link href="/login">Sign In</Link><Link href="/signup">Create Account</Link></div>
          <div><strong>Legal</strong><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable Use</Link></div>
        </nav>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} BracketWorks. All rights reserved.</span><span>Legal draft v{document.version}</span></div>
      </footer>
    </main>
  );
}
