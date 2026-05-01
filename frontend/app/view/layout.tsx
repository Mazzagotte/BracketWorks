import styles from './view-layout.module.css'

export default function PublicViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.inner}>{children}</div>
    </div>
  )
}