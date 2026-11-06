import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Card, ICON_SIZE, NavItem, Notice, Page, PageHeader, TopNav, TopNavBrand, buttonClassName } from '@bracketworks/ui';

import content from './legal-content.json';
import styles from './legal.module.css';

export type LegalDocumentKey = keyof typeof content;

const LEGAL_LINKS: Array<{ href: string; label: string; key: LegalDocumentKey }> = [
  { href: '/terms', label: 'Terms of service', key: 'terms' },
  { href: '/privacy', label: 'Privacy policy', key: 'privacy' },
  { href: '/operator-terms', label: 'Operator terms', key: 'operatorTerms' },
  { href: '/acceptable-use', label: 'Acceptable use', key: 'acceptableUse' },
];

const PROPER_WORDS: Record<string, string> = {
  bracketworks: 'BracketWorks',
  usbc: 'USBC',
  idaho: 'Idaho',
  tournament_central: 'Tournament Central',
};

/** Legal headings arrive in capitals or title case; the standard uses sentence case. */
function sentenceCase(text: string): string {
  const lower = text.toLowerCase();
  const words = lower.split(/(\s+)/).map(word => {
    const bare = word.replace(/[^a-z]/g, '');
    const proper = PROPER_WORDS[bare];
    return proper ? word.replace(bare, proper) : word;
  });
  const joined = words.join('').replace(/tournament central/g, 'Tournament Central');
  return joined.replace(/[a-z]/, letter => letter.toUpperCase());
}

function sectionId(heading: string): string {
  return `section-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

function renderParagraphs(paragraphs: readonly string[]) {
  const output: ReactNode[] = [];
  let letteredItems: string[] = [];

  const flushLetteredItems = () => {
    if (!letteredItems.length) return;
    output.push(
      <ol className={styles.lettered} type="a" key={`list-${output.length}`}>
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
    const isCapitalizedNotice = paragraph.length > 60 && paragraph === paragraph.toUpperCase() && /[A-Z]/.test(paragraph);
    output.push(<p className={isCapitalizedNotice ? styles.emphasis : styles.text} key={`${paragraph}-${index}`}>{paragraph}</p>);
  });
  flushLetteredItems();
  return output;
}

/** A legal document: shared top bar, narrow reading page, sections split by dividers in one card. */
export default function LegalDocumentPage({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = content[documentKey];
  const effectiveDate = document.intro.find(paragraph => paragraph.startsWith('Effective Date:'))?.replace('Effective Date:', '').trim();
  const introParagraphs = document.intro.filter(paragraph => !paragraph.startsWith('Effective Date:') && !paragraph.startsWith('Draft Version:'));
  const effectiveLabel = effectiveDate && !effectiveDate.includes('[Insert') ? `Effective ${effectiveDate}` : 'Effective date pending';

  return (
    <div className={styles.shell}>
      <TopNav
        navLabel="Public"
        brand={(
          <TopNavBrand
            href="/"
            aria-label="BracketWorks home"
            mark={<Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />}
            name="BracketWorks"
          />
        )}
        actions={(
          <>
            <Link href="/login" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>Log in</Link>
            <Link href="/signup" className={buttonClassName({ variant: 'primary', size: 'sm' })}>Create account</Link>
          </>
        )}
      >
        <NavItem href="/">Home</NavItem>
        <NavItem href="/view">Live View</NavItem>
      </TopNav>

      <Page width="narrow">
        <PageHeader overline="BracketWorks legal" title={sentenceCase(document.title)} description={`Draft version ${document.version} · ${effectiveLabel}`} />

        <nav className={styles.legalNav} aria-label="Legal documents">
          {LEGAL_LINKS.map(link => (
            <Link key={link.href} href={link.href} aria-current={link.key === documentKey ? 'page' : undefined}>{link.label}</Link>
          ))}
        </nav>

        <Notice tone="warning">
          This is a pre-publication draft. BracketWorks must confirm the remaining business and legal details before these terms take effect.
        </Notice>

        <Card>
          <div className={styles.document}>
            {introParagraphs.length > 0 ? <div className={styles.intro}>{renderParagraphs(introParagraphs)}</div> : null}
            <nav className={styles.contents} aria-label="In this document">
              <h2 className={styles.contentsTitle}>In this document</h2>
              <ol>
                {document.sections.map(section => <li key={section.heading}><a href={`#${sectionId(section.heading)}`}>{sentenceCase(section.heading)}</a></li>)}
              </ol>
            </nav>
            {document.sections.map(section => (
              <section id={sectionId(section.heading)} key={section.heading} className={styles.section}>
                <h2 className={styles.sectionTitle}>{sentenceCase(section.heading)}</h2>
                {renderParagraphs(section.paragraphs)}
              </section>
            ))}
          </div>
        </Card>
      </Page>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} BracketWorks · Legal draft v{document.version}</span>
        <Link href="/">Home</Link>
        <Link href="/view">Live View</Link>
        <Link href="/login">Log in</Link>
      </footer>
    </div>
  );
}
