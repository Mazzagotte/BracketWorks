import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';

export function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerBrand}>
              <Image
                src="/logo_no_text.svg"
                alt="BracketWorks"
                width={28}
                height={28}
              />
              <div className={styles.footerBrandText}>
                <strong>BracketWorks</strong>
                <span>Bowling Brackets & Side Pots</span>
              </div>
            </div>
            <p className={styles.footerDescription}>
              Modern tournament operations for bowling directors.
            </p>
          </div>

          <div className={styles.footerColumn}>
            <h4>Product</h4>
            <ul className={styles.footerLinks}>
              <li><a href="#features" className={styles.footerLink}>Features</a></li>
              <li><a href="#live-view" className={styles.footerLink}>Live View</a></li>
              <li><a href="#how-it-works" className={styles.footerLink}>How It Works</a></li>
              <li><a href="#tournament-central" className={styles.footerLink}>Tournament Central</a></li>
            </ul>
          </div>

          <div className={styles.footerColumn}>
            <h4>Resources</h4>
            <ul className={styles.footerLinks}>
              <li><a href="/help" className={styles.footerLink}>Help</a></li>
              <li><a href="/guides" className={styles.footerLink}>Guides</a></li>
              <li><a href="/blog" className={styles.footerLink}>Blog</a></li>
              <li><a href="mailto:support@bracketworks.app" className={styles.footerLink}>Contact</a></li>
            </ul>
          </div>

          <div className={styles.footerColumn}>
            <h4>Account</h4>
            <ul className={styles.footerLinks}>
              <li><Link href="/login" className={styles.footerLink}>Sign In</Link></li>
              <li><Link href="/signup" className={styles.footerLink}>Create Account</Link></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.footerCopyright}>
            © {currentYear} BracketWorks. All rights reserved.
          </p>
          <ul className={styles.footerBottomLinks}>
            <li><a href="/terms" className={styles.footerBottomLink}>Terms of Service</a></li>
            <li><a href="/privacy" className={styles.footerBottomLink}>Privacy Policy</a></li>
            <li><a href="/acceptable-use" className={styles.footerBottomLink}>Acceptable Use</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
