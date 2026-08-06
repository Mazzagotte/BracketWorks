'use client';

import { useState } from 'react';
import styles from './demo-live-phone.module.css';

export default function DemoLiveView() {
  const [isLoaded, setIsLoaded] = useState(false);
  return <div className={styles.phone}>{!isLoaded && <div className={styles.loading} role="status">Loading Live View…</div>}<iframe className={styles.screen} src="/view/demo?modal=1" title="The Famous Frames Invitational Live View" loading="lazy" onLoad={() => setIsLoaded(true)} data-loaded={isLoaded} /></div>;
}
