"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { apiClient, apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { calculatePasswordStrengthPercent, getPasswordRequirementChecks, hasStrongPassword } from '../lib/auth/validation';
import PasswordStrengthPanel from '../components/PasswordStrengthPanel';
import { Card, CardBody, CardHeader, QuickActions, SectionHeader } from '../components/primitives';
import buttonStyles from '../styles/buttons.module.css';
import styles from './settings.module.css';
import Link from 'next/link';
import { openOnboarding } from '../lib/onboarding';
import { openLegalDisclosure } from '../lib/legalDisclosure';

type AccountProfile = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  organization: string;
  email_verified?: boolean;
  email_verified_at?: string | null;
};

type ActiveSession = {
  session_id: string;
  issued_at: string;
  last_seen_at: string;
  expires_at: string;
  device_nickname: string | null;
  region_hint: string | null;
  is_current: boolean;
};

type DeletionPreview = {
  can_delete: boolean;
  confirmation_phrase: string;
  owned_tournaments: { id: number; name: string; lifecycle_status: string }[];
  deleted: string[];
  retained: string[];
};

const emptyProfile: AccountProfile = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  organization: '',
  email_verified: false,
  email_verified_at: null,
};

function formatVerifiedDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString();
}

export default function SettingsPage() {
  const router = useRouter();
  const { updateUserData, logoutUser } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [profile, setProfile] = useState<AccountProfile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<AccountProfile>(emptyProfile);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [logoutAfterPasswordChange, setLogoutAfterPasswordChange] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'problem' | 'feature' | 'other'>('problem');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<DeletionPreview | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const verifiedOnLabel = formatVerifiedDate(profile.email_verified_at);
  const profileErrors = useMemo(() => ({
    username: profile.username.trim() ? '' : 'Username is required.',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) ? '' : 'Enter a valid email address.',
  }), [profile.email, profile.username]);
  const profileIsValid = !profileErrors.username && !profileErrors.email;
  const profileIsDirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const passwordIsComplete = Boolean(
    passwordForm.current_password && passwordForm.new_password && passwordForm.confirm_password
  );
  const passwordsMatch = !passwordForm.confirm_password || passwordForm.new_password === passwordForm.confirm_password;
  const passwordCanSubmit = passwordIsComplete && passwordsMatch && hasStrongPassword(passwordForm.new_password, 8);


  useEffect(() => {
    const load = async () => {
      try {
        const me = await apiClient.get<AccountProfile & { id: number; is_admin: boolean }>('/api/v1/users/me', false);
        const loadedProfile = {
          first_name: me.first_name || '',
          last_name: me.last_name || '',
          username: me.username || '',
          email: me.email || '',
          organization: me.organization || '',
          email_verified: Boolean(me.email_verified),
          email_verified_at: me.email_verified_at || null,
        };
        setProfile(loadedProfile);
        setSavedProfile(loadedProfile);
      } catch (err) {
        addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load account settings', duration: 5000 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [addToast]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const result = await apiClient.get<{ sessions: ActiveSession[] }>('/api/v1/users/sessions', false);
      setSessions(result.sessions);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load active sessions', duration: 5000 });
    } finally {
      setSessionsLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  useEffect(() => {
    apiClient.get<DeletionPreview>('/api/v1/users/account/deletion-preview', false)
      .then(setDeletionPreview)
      .catch(err => addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load account deletion status' }));
  }, [addToast]);

  const downloadAccountData = async () => {
    setExportingData(true);
    try {
      const response = await apiFetch('/api/v1/users/account/export');
      if (!response.ok) throw new Error('Unable to prepare account export.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bracketworks-account-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', message: 'Account data downloaded.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to download account data' });
    } finally {
      setExportingData(false);
    }
  };

  const deleteAccount = async () => {
    if (!deletionPreview?.can_delete || deleteConfirmation !== deletionPreview.confirmation_phrase || !deletePassword) return;
    if (!window.confirm('Permanently deactivate and anonymize this account? This cannot be undone.')) return;
    setDeletingAccount(true);
    try {
      await apiClient.post('/api/v1/users/account/delete', { current_password: deletePassword, confirmation: deleteConfirmation });
      logoutUser({ fastRedirect: true });
      router.replace('/login');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete account', duration: 5000 });
      setDeletingAccount(false);
    }
  };

  const revokeSession = async (session: ActiveSession) => {
    if (session.is_current) {
      if (window.confirm('Sign out this device now?')) logoutUser();
      return;
    }
    if (!window.confirm(`Sign out ${session.device_nickname || 'this session'}?`)) return;
    setSessionAction(session.session_id);
    try {
      await apiClient.post('/api/v1/users/sessions/revoke', { session_id: session.session_id });
      setSessions(previous => previous.filter(item => item.session_id !== session.session_id));
      addToast({ type: 'success', message: 'Session signed out.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to sign out session' });
    } finally {
      setSessionAction(null);
    }
  };

  const revokeOtherSessions = async () => {
    if (!window.confirm('Sign out every other device? Your current session will remain active.')) return;
    setSessionAction('others');
    try {
      const result = await apiClient.post<{ revoked_sessions: number }>('/api/v1/users/sessions/revoke-others');
      setSessions(previous => previous.filter(session => session.is_current));
      addToast({ type: 'success', message: `${result.revoked_sessions} other session${result.revoked_sessions === 1 ? '' : 's'} signed out.` });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to sign out other sessions' });
    } finally {
      setSessionAction(null);
    }
  };

  useEffect(() => {
    if (loading || window.location.hash !== '#feedback-form') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('feedback-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  const passwordStrengthPercent = useMemo(
    () => calculatePasswordStrengthPercent(passwordForm.new_password, 8),
    [passwordForm.new_password]
  );

  const passwordStrengthTone = useMemo(() => {
    if (passwordStrengthPercent < 25) return 'weak' as const;
    if (passwordStrengthPercent < 50) return 'fair' as const;
    if (passwordStrengthPercent < 75) return 'good' as const;
    return 'strong' as const;
  }, [passwordStrengthPercent]);

  const passwordStrengthText = useMemo(() => {
    if (passwordStrengthPercent < 25) return 'Weak';
    if (passwordStrengthPercent < 50) return 'Fair';
    if (passwordStrengthPercent < 75) return 'Good';
    return 'Strong';
  }, [passwordStrengthPercent]);

  const passwordChecks = useMemo(
    () => getPasswordRequirementChecks(passwordForm.new_password, 8),
    [passwordForm.new_password]
  );

  const requirementItems = useMemo(
    () => [
      { label: 'At least 8 characters', met: passwordChecks.minLength },
      { label: 'One lowercase letter', met: passwordChecks.lower },
      { label: 'One uppercase letter', met: passwordChecks.upper },
      { label: 'One number', met: passwordChecks.number },
      { label: 'One symbol', met: passwordChecks.special },
    ],
    [passwordChecks]
  );

  const handleProfileChange = (key: keyof AccountProfile, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const resendVerificationEmail = async () => {
    if (profile.email_verified) {
      addToast({ type: 'info', message: 'This email is already verified.', duration: 2500 });
      return;
    }

    setResendingVerification(true);
    try {
      await apiClient.post('/api/v1/users/request-email-verification', {});
      addToast({ type: 'success', message: `Verification email sent to ${profile.email}.`, duration: 3500 });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send verification email', duration: 5000 });
    } finally {
      setResendingVerification(false);
    }
  };

  const saveProfile = async () => {
    if (!profileIsValid) {
      addToast({ type: 'warning', message: profileErrors.username || profileErrors.email, duration: 3000 });
      return;
    }

    setSavingProfile(true);
    try {
      const previousEmail = profile.email.trim().toLowerCase();
      const updated = await apiClient.put<AccountProfile & { id: number; is_admin: boolean }>('/api/v1/users/me', {
        first_name: profile.first_name.trim(),
        last_name: profile.last_name.trim(),
        username: profile.username.trim(),
        email: profile.email.trim(),
        organization: profile.organization.trim() || null,
      });

      const saved = {
        first_name: updated.first_name || '',
        last_name: updated.last_name || '',
        username: updated.username || '',
        email: updated.email || '',
        organization: updated.organization || '',
        email_verified: Boolean(updated.email_verified),
        email_verified_at: updated.email_verified_at || null,
      };
      setProfile(saved);
      setSavedProfile(saved);

      if (updated.first_name) {
        localStorage.setItem('first_name', updated.first_name);
        updateUserData({ name: updated.first_name });
      }

      const emailChanged = previousEmail !== (updated.email || '').trim().toLowerCase();
      if (emailChanged) {
        addToast({
          type: 'success',
          message: `Email updated. We sent a change notice to ${previousEmail} and a new verification email to ${updated.email}.`,
          duration: 5000,
        });
      } else {
        addToast({ type: 'success', message: 'Account updated.', duration: 2500 });
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update account', duration: 5000 });
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      addToast({ type: 'warning', message: 'Complete all password fields.', duration: 3000 });
      return;
    }

    if (!hasStrongPassword(passwordForm.new_password, 8)) {
      addToast({ type: 'warning', message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.', duration: 4000 });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      addToast({ type: 'warning', message: 'New password and confirmation do not match.', duration: 3000 });
      return;
    }

    setSavingPassword(true);
    try {
      await apiClient.post('/api/v1/users/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        sign_out_current_session: logoutAfterPasswordChange,
      });

      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      addToast({ type: 'success', message: 'Password updated. A confirmation email was sent to your account.', duration: 3500 });

      if (logoutAfterPasswordChange) {
        addToast({ type: 'info', message: 'Signing out for security. Please log in with your new password.', duration: 3000 });
        logoutUser();
        router.push('/login');
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update password', duration: 5000 });
    } finally {
      setSavingPassword(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      addToast({ type: 'warning', message: 'Add a subject and message before sending.', duration: 3000 });
      return;
    }
    setSendingFeedback(true);
    try {
      await apiClient.post('/api/v1/users/feedback', { category: feedbackCategory, subject: feedbackSubject.trim(), message: feedbackMessage.trim() });
      setFeedbackSubject('');
      setFeedbackMessage('');
      addToast({ type: 'success', message: 'Message sent to the BracketWorks team.', duration: 3500 });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send message', duration: 5000 });
    } finally {
      setSendingFeedback(false);
    }
  };

  if (loading) {
    return <div className={styles.loadingState} role="status">Loading account settings...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.settingsIntro}>
        <p className={styles.eyebrow}>Account preferences</p>
        <h2>Account settings</h2>
        <p>Manage your BracketWorks account, security, help resources, and legal information. Tournament configuration remains with each tournament.</p>
      </header>
      <div className={styles.settingsLayout}>
        <nav className={styles.sectionNav} aria-label="Settings sections">
          <a href="#account">Account</a><a href="#security">Security</a><a href="#sessions">Sessions</a><a href="#data">Security &amp; Data</a><a href="#help">Help</a><a href="#legal">Legal</a>
        </nav>
        <div className={styles.settingsContent}>
      <section id="account" className={styles.settingsSection}>
      <Card className={styles.card} variant="primary">
        <CardHeader className={styles.cardTitleWrap}>
          <SectionHeader title="Account" subtitle="Profile, verification, and organization" className={styles.cardTitleSectionHeader} />
        </CardHeader>
        <CardBody>
        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>First Name</div>
          </div>
          <input
            className={styles.input}
            aria-label="First name"
            value={profile.first_name}
            onChange={e => handleProfileChange('first_name', e.target.value)}
            placeholder="First name"
          />
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Last Name</div>
          </div>
          <input
            className={styles.input}
            aria-label="Last name"
            value={profile.last_name}
            onChange={e => handleProfileChange('last_name', e.target.value)}
            placeholder="Last name"
          />
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Username</div>
          </div>
          <input
            className={styles.input}
            aria-label="Username"
            value={profile.username}
            onChange={e => handleProfileChange('username', e.target.value)}
            placeholder="Username"
            aria-invalid={Boolean(profileErrors.username)}
          />
          {profileErrors.username && <span className={styles.fieldError}>{profileErrors.username}</span>}
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Email</div>
          </div>
          <input
            className={styles.input}
            aria-label="Email"
            type="email"
            value={profile.email}
            onChange={e => handleProfileChange('email', e.target.value)}
            placeholder="Email"
            aria-invalid={Boolean(profileErrors.email)}
          />
          {profileErrors.email && <span className={styles.fieldError}>{profileErrors.email}</span>}
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Email Verification</div>
            <div className={styles.optionHint}>
              {profile.email_verified
                ? verifiedOnLabel
                  ? `Your account email is verified. Verified on ${verifiedOnLabel}.`
                  : 'Your account email is verified.'
                : 'Your account email is not verified yet. Some security actions may require verification.'}
            </div>
          </div>
          <div className={styles.verificationPanel}>
            <div className={profile.email_verified ? styles.verificationBadgeVerified : styles.verificationBadgePending}>
              {profile.email_verified ? 'Verified' : 'Verification Required'}
            </div>
            {!profile.email_verified ? (
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`}
                onClick={resendVerificationEmail}
                disabled={resendingVerification}
              >
                {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Organization</div>
          </div>
          <input
            className={styles.input}
            aria-label="Organization"
            value={profile.organization}
            onChange={e => handleProfileChange('organization', e.target.value)}
            placeholder="Organization"
          />
        </div>

        <QuickActions
          className={styles.actionRow}
          left={<span className={styles.inlineMeta}>Update your profile details and verification settings.</span>}
          right={(
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={saveProfile} disabled={savingProfile || !profileIsValid || !profileIsDirty}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          )}
        />
        </CardBody>
      </Card>
      </section>

      <section id="security" className={styles.settingsSection}>
      <Card className={styles.card} variant="primary">
        <CardHeader className={styles.cardTitleWrap}>
          <SectionHeader title="Security" className={styles.cardTitleSectionHeader} />
        </CardHeader>
        <CardBody>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Current Password</div>
          </div>
          <div className={styles.passwordFieldWrap}>
            <input
              className={styles.input}
              aria-label="Current password"
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordForm.current_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
              placeholder="Current password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
              aria-label={`${showPasswords.current ? 'Hide' : 'Show'} current password`}
              onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
            >
              {showPasswords.current ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>New Password</div>
          </div>
          <div className={styles.passwordFieldWrap}>
            <input
              className={styles.input}
              aria-label="New password"
              type={showPasswords.next ? 'text' : 'password'}
              value={passwordForm.new_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
              placeholder="New password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
              aria-label={`${showPasswords.next ? 'Hide' : 'Show'} new password`}
              onClick={() => setShowPasswords(prev => ({ ...prev, next: !prev.next }))}
            >
              {showPasswords.next ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordForm.new_password.length > 0 && (
            <PasswordStrengthPanel
              strengthText={passwordStrengthText}
              strengthPercent={passwordStrengthPercent}
              tone={passwordStrengthTone}
              requirements={requirementItems}
            />
          )}
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Confirm New Password</div>
          </div>
          <div className={styles.passwordFieldWrap}>
            <input
              className={styles.input}
              aria-label="Confirm new password"
              aria-invalid={!passwordsMatch}
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordForm.confirm_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
              aria-label={`${showPasswords.confirm ? 'Hide' : 'Show'} password confirmation`}
              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
            >
              {showPasswords.confirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {!passwordsMatch && <span className={styles.fieldError}>New password and confirmation do not match.</span>}
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>After Password Change</div>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={logoutAfterPasswordChange}
              onChange={e => setLogoutAfterPasswordChange(e.target.checked)}
            />
            Sign out this device
          </label>
        </div>

        <QuickActions
          className={styles.actionRow}
          left={<span className={styles.inlineMeta}>Use a strong password and optional device sign-out.</span>}
          right={(
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={updatePassword} disabled={savingPassword || !passwordCanSubmit}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          )}
        />
        </CardBody>
      </Card>
      </section>

      <section id="sessions" className={styles.settingsSection}>
      <Card className={styles.card} variant="primary">
        <CardHeader className={styles.cardTitleWrap}>
          <SectionHeader title="Active Sessions" subtitle="Devices currently signed in to your account" className={styles.cardTitleSectionHeader} />
        </CardHeader>
        <CardBody>
          {sessionsLoading ? <div className={styles.sessionsEmpty} role="status">Loading active sessions...</div> : sessions.length === 0 ? <div className={styles.sessionsEmpty}>No active sessions found.</div> : (
            <div className={styles.sessionList}>
              {sessions.map(session => (
                <div className={styles.sessionRow} key={session.session_id}>
                  <div className={styles.sessionIdentity}>
                    <div className={styles.sessionTitle}>{session.device_nickname || 'Browser session'} {session.is_current && <span className={styles.currentBadge}>Current</span>}</div>
                    <div className={styles.optionHint}>{session.region_hint || 'Approximate location unavailable'}</div>
                    <div className={styles.optionHint}>Last active {new Date(session.last_seen_at).toLocaleString()} · Signed in {new Date(session.issued_at).toLocaleDateString()}</div>
                  </div>
                  <button type="button" className={`${buttonStyles.button} ${session.is_current ? buttonStyles.secondary : buttonStyles.outline} ${buttonStyles.small}`} disabled={sessionAction !== null} onClick={() => void revokeSession(session)}>
                    {sessionAction === session.session_id ? 'Signing out...' : session.is_current ? 'Sign Out This Device' : 'Sign Out'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <QuickActions
            className={styles.actionRow}
            left={<span className={styles.inlineMeta}>Revoked devices must sign in again before accessing BracketWorks.</span>}
            right={<button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} disabled={sessionAction !== null || sessions.filter(session => !session.is_current).length === 0} onClick={() => void revokeOtherSessions()}>{sessionAction === 'others' ? 'Signing out...' : 'Sign Out All Other Devices'}</button>}
          />
        </CardBody>
      </Card>
      </section>

      <section id="data" className={styles.settingsSection}>
      <Card className={styles.card} variant="primary">
        <CardHeader className={styles.cardTitleWrap}>
          <SectionHeader title="Security & Data" subtitle="Export your information or permanently close your account" className={styles.cardTitleSectionHeader} />
        </CardHeader>
        <CardBody>
          <div className={styles.dataActionBlock}>
            <div className={styles.optionText}><div className={styles.optionTitle}>Download My Data</div><div className={styles.optionHint}>Download a portable JSON file containing your profile, owned tournaments, tournament records, and activity history.</div></div>
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} disabled={exportingData} onClick={() => void downloadAccountData()}>{exportingData ? 'Preparing...' : 'Download JSON'}</button>
          </div>
          <div className={styles.deleteAccountBlock}>
            <div className={styles.optionText}><div className={styles.optionTitle}>Delete Account</div><div className={styles.optionHint}>Deletion deactivates your account, signs out all devices, and anonymizes personal profile information.</div></div>
            {deletionPreview && (
              <>
                <div className={styles.retentionGrid}>
                  <div><strong>Deleted or anonymized</strong><ul>{deletionPreview.deleted.map(item => <li key={item}>{item}</li>)}</ul></div>
                  <div><strong>Retained for integrity or legal records</strong><ul>{deletionPreview.retained.map(item => <li key={item}>{item}</li>)}</ul></div>
                </div>
                {deletionPreview.owned_tournaments.length > 0 ? (
                  <div className={styles.ownershipBlocker} role="alert">
                    <strong>Ownership must be resolved first.</strong>
                    <span>Transfer or remove ownership of these tournaments before deleting your account:</span>
                    <ul>{deletionPreview.owned_tournaments.map(item => <li key={item.id}>{item.name} ({item.lifecycle_status})</li>)}</ul>
                  </div>
                ) : (
                  <div className={styles.deleteConfirmFields}>
                    <label>Current password<input className={styles.input} type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="current-password" /></label>
                    <label>Type <strong>{deletionPreview.confirmation_phrase}</strong><input className={styles.input} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
                    <button type="button" className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.small}`} disabled={deletingAccount || !deletePassword || deleteConfirmation !== deletionPreview.confirmation_phrase} onClick={() => void deleteAccount()}>{deletingAccount ? 'Deleting...' : 'Permanently Delete Account'}</button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardBody>
      </Card>
      </section>

      <section id="help" className={styles.settingsSection}>
      <Card className={styles.card} variant="primary">
        <CardHeader className={styles.cardTitleWrap}>
          <SectionHeader title="Help and Onboarding" className={styles.cardTitleSectionHeader} />
        </CardHeader>
        <CardBody>
          <div className={styles.helpBlock}>
            <div><div className={styles.optionTitle}>Getting Started</div><div className={styles.optionHint}>Review the complete tournament workflow or reopen the welcome message at any time.</div></div>
            <div className={styles.helpActions}>
              <Link href="/help/getting-started" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`}>Open Guide</Link>
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={openOnboarding}>Show Welcome Message</button>
            </div>
          </div>
          <div id="feedback-form" className={styles.feedbackForm}>
            <div className={styles.optionText}><div className={styles.optionTitle}>Report a problem or request a feature</div><div className={styles.optionHint}>Send a message to the BracketWorks administrators. Include steps to reproduce a problem when possible.</div></div>
            <div className={styles.feedbackFormGrid}>
              <select className={styles.input} aria-label="Message type" value={feedbackCategory} onChange={event => setFeedbackCategory(event.target.value as 'problem' | 'feature' | 'other')}><option value="problem">Report a problem</option><option value="feature">Request a feature</option><option value="other">Other</option></select>
              <input className={styles.input} aria-label="Message subject" value={feedbackSubject} onChange={event => setFeedbackSubject(event.target.value)} placeholder="Subject" maxLength={160} />
            </div>
            <textarea className={styles.feedbackTextarea} aria-label="Message" value={feedbackMessage} onChange={event => setFeedbackMessage(event.target.value)} placeholder="Describe the problem or idea" maxLength={5000} rows={5} />
            <div className={styles.feedbackFormFooter}><span className={styles.inlineMeta}>{feedbackMessage.length}/5000</span><button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={submitFeedback} disabled={sendingFeedback || !feedbackSubject.trim() || !feedbackMessage.trim()}>{sendingFeedback ? 'Sending...' : 'Send Message'}</button></div>
          </div>
        </CardBody>
      </Card>
      </section>

      <section id="legal" className={styles.settingsSection}>
        <Card className={styles.card} variant="primary">
          <CardHeader className={styles.cardTitleWrap}>
            <SectionHeader title="Legal" subtitle="BracketWorks policies and acceptable use" className={styles.cardTitleSectionHeader} />
          </CardHeader>
          <CardBody>
            <div className={styles.legalLinks}>
              <button type="button" onClick={openLegalDisclosure}>Periodic Use Disclosure<span>Review the disclosure and your current acceptance period.</span></button>
              <Link href="/terms">Terms of Service<span>Terms governing your BracketWorks account.</span></Link>
              <Link href="/privacy">Privacy Policy<span>How account and tournament data is handled.</span></Link>
              <Link href="/acceptable-use">Acceptable Use<span>Permitted and prohibited use of the service.</span></Link>
            </div>
          </CardBody>
        </Card>
      </section>

        </div>
      </div>

    </div>
  );
}
