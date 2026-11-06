"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { apiClient, apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { calculatePasswordStrengthPercent, getPasswordRequirementChecks, hasStrongPassword } from '../lib/auth/validation';
import PasswordStrengthPanel from '../components/PasswordStrengthPanel';
import { Download, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  FormGrid,
  ICON_SIZE,
  Notice,
  Page,
  PageHeader,
  PasswordField,
  SelectField,
  SideNav,
  TextAreaField,
  TextField,
  buttonClassName,
} from '@bracketworks/ui';
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

const MAX_VISIBLE_SESSIONS = 5;

const SETTINGS_SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'data', label: 'Your data' },
  { id: 'help', label: 'Help' },
  { id: 'legal', label: 'Legal' },
];

const LEGAL_LINKS = [
  { href: '/terms', title: 'Terms of service', text: 'Terms governing your BracketWorks account.' },
  { href: '/privacy', title: 'Privacy policy', text: 'How account and tournament data is handled.' },
  { href: '/acceptable-use', title: 'Acceptable use', text: 'Permitted and prohibited use of the service.' },
];

type SessionConfirm = { kind: 'one'; session: ActiveSession } | { kind: 'others' } | null;

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
  const [activeSection, setActiveSection] = useState('account');
  const [sessionConfirm, setSessionConfirm] = useState<SessionConfirm>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
    setDeletingAccount(true);
    try {
      await apiClient.post('/api/v1/users/account/delete', { current_password: deletePassword, confirmation: deleteConfirmation });
      logoutUser({ fastRedirect: true });
      router.replace('/login');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete account', duration: 5000 });
      setDeletingAccount(false);
      setDeleteConfirmOpen(false);
    }
  };

  const revokeSession = async (session: ActiveSession) => {
    if (session.is_current) {
      logoutUser();
      return;
    }
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
    return <Page><p className={styles.status} role="status">Loading account settings...</p></Page>;
  }

  const otherSessionCount = sessions.filter(session => !session.is_current).length;
  const goToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Page>
      <PageHeader
        title="Account settings"
        description="Manage your BracketWorks account, security, help, and legal information. Tournament settings stay with each tournament."
      />
      <div className={styles.layout}>
        <SideNav
          label="Settings sections"
          className={styles.sideNav}
          activeId={activeSection}
          onSelect={goToSection}
          sections={[{ items: SETTINGS_SECTIONS.map(section => ({ id: section.id, label: section.label })) }]}
        />
        <div className={styles.content}>
          <Card id="account" aria-labelledby="account-title">
            <CardHeader title={<span id="account-title">Account</span>} description="Profile, verification, and organization" />
            <div className={styles.cardBody}>
              <FormGrid>
                <TextField label="First name" value={profile.first_name} onChange={e => handleProfileChange('first_name', e.target.value)} autoComplete="given-name" />
                <TextField label="Last name" value={profile.last_name} onChange={e => handleProfileChange('last_name', e.target.value)} autoComplete="family-name" />
                <TextField label="Username" value={profile.username} onChange={e => handleProfileChange('username', e.target.value)} error={profileErrors.username || undefined} autoComplete="username" />
                <TextField label="Email" type="email" value={profile.email} onChange={e => handleProfileChange('email', e.target.value)} error={profileErrors.email || undefined} autoComplete="email" />
                <TextField label="Organization" optional value={profile.organization} onChange={e => handleProfileChange('organization', e.target.value)} autoComplete="organization" />
              </FormGrid>
              <CardDivider />
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <h3 className={styles.subsectionTitle}>
                    Email verification
                    <Badge tone={profile.email_verified ? 'success' : 'warning'}>{profile.email_verified ? 'Verified' : 'Not verified'}</Badge>
                  </h3>
                  <p className={styles.meta}>
                    {profile.email_verified
                      ? verifiedOnLabel ? `Verified on ${verifiedOnLabel}.` : 'Your account email is verified.'
                      : 'Some security actions need a verified email.'}
                  </p>
                </div>
                {!profile.email_verified ? (
                  <Button size="sm" variant="secondary" onClick={resendVerificationEmail} disabled={resendingVerification}>
                    {resendingVerification ? 'Sending...' : 'Resend verification email'}
                  </Button>
                ) : null}
              </div>
              <div className={styles.footer}>
                <Button variant="primary" onClick={saveProfile} disabled={savingProfile || !profileIsValid || !profileIsDirty}>
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </Button>
              </div>
            </div>
          </Card>

          <Card id="security" aria-labelledby="security-title">
            <CardHeader title={<span id="security-title">Security</span>} description="Change your password. Use at least 8 characters with mixed case, a number, and a symbol." />
            <div className={styles.cardBody}>
              <FormGrid>
                <PasswordField label="Current password" fullRow value={passwordForm.current_password} onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))} autoComplete="current-password" />
                <div className={styles.fullRow}>
                  <PasswordField label="New password" value={passwordForm.new_password} onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))} autoComplete="new-password" />
                  {passwordForm.new_password.length > 0 ? (
                    <PasswordStrengthPanel
                      strengthText={passwordStrengthText}
                      strengthPercent={passwordStrengthPercent}
                      tone={passwordStrengthTone}
                      requirements={requirementItems}
                    />
                  ) : null}
                </div>
                <PasswordField
                  label="Confirm new password"
                  fullRow
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                  error={passwordsMatch ? undefined : 'New password and confirmation do not match.'}
                  autoComplete="new-password"
                />
              </FormGrid>
              <CheckboxField
                label="Sign out this device after changing the password"
                checked={logoutAfterPasswordChange}
                onChange={e => setLogoutAfterPasswordChange(e.target.checked)}
              />
              <div className={styles.footer}>
                <Button variant="primary" onClick={updatePassword} disabled={savingPassword || !passwordCanSubmit}>
                  {savingPassword ? 'Updating...' : 'Update password'}
                </Button>
              </div>
            </div>
          </Card>

          <Card id="sessions" padding="flush" aria-labelledby="sessions-title">
            <CardHeader
              title={<span id="sessions-title">Active sessions</span>}
              description="Devices signed in to your account. Signed-out devices must sign in again."
              actions={(
                <Button size="sm" variant="secondary" disabled={sessionAction !== null || otherSessionCount === 0} onClick={() => setSessionConfirm({ kind: 'others' })}>
                  {sessionAction === 'others' ? 'Signing out...' : 'Sign out other devices'}
                </Button>
              )}
            />
            {sessionsLoading ? (
              <p className={styles.flushStatus} role="status">Loading active sessions...</p>
            ) : sessions.length === 0 ? (
              <p className={styles.flushStatus}>No active sessions found.</p>
            ) : (
              <ul className={styles.list}>
                {/* Backend caps concurrent sessions at MAX_ACTIVE_SESSIONS_PER_USER; slice is just a defensive guard. */}
                {sessions.slice(0, MAX_VISIBLE_SESSIONS).map(session => (
                  <li className={styles.listRow} key={session.session_id}>
                    <div className={styles.rowText}>
                      <span className={styles.rowTitle}>
                        {session.device_nickname || 'Browser session'}
                        {session.is_current ? <Badge tone="neutral">Current</Badge> : null}
                      </span>
                      <span className={styles.meta}>
                        {[session.region_hint || 'Location unavailable', `Last active ${new Date(session.last_seen_at).toLocaleString()}`, `Signed in ${new Date(session.issued_at).toLocaleDateString()}`].join(' · ')}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" disabled={sessionAction !== null} onClick={() => setSessionConfirm({ kind: 'one', session })}>
                      {sessionAction === session.session_id ? 'Signing out...' : 'Sign out'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card id="data" aria-labelledby="data-title">
            <CardHeader title={<span id="data-title">Your data</span>} description="Export your information or permanently close your account." />
            <div className={styles.cardBody}>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <h3 className={styles.subsectionTitle}>Download my data</h3>
                  <p className={styles.meta}>A JSON file with your profile, owned tournaments, tournament records, and activity history.</p>
                </div>
                <Button size="sm" variant="secondary" icon={<Download size={ICON_SIZE.md} aria-hidden="true" />} disabled={exportingData} onClick={() => void downloadAccountData()}>
                  {exportingData ? 'Preparing...' : 'Download JSON'}
                </Button>
              </div>
              <CardDivider />
              <div className={styles.rowText}>
                <h3 className={styles.subsectionTitle}>Delete account</h3>
                <p className={styles.meta}>Deletion deactivates your account, signs out all devices, and anonymizes your personal profile information.</p>
              </div>
              {deletionPreview ? (
                <>
                  <div className={styles.retention}>
                    <div>
                      <p className={styles.label}>Deleted or anonymized</p>
                      <ul className={styles.bullets}>{deletionPreview.deleted.map(item => <li key={item}>{item}</li>)}</ul>
                    </div>
                    <div>
                      <p className={styles.label}>Kept for integrity or legal records</p>
                      <ul className={styles.bullets}>{deletionPreview.retained.map(item => <li key={item}>{item}</li>)}</ul>
                    </div>
                  </div>
                  {deletionPreview.owned_tournaments.length > 0 ? (
                    <Notice tone="warning" role="alert">
                      Transfer or remove ownership of these tournaments before deleting your account:{' '}
                      {deletionPreview.owned_tournaments.map(item => `${item.name} (${item.lifecycle_status})`).join(', ')}.
                    </Notice>
                  ) : (
                    <>
                      <FormGrid>
                        <PasswordField label="Current password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="current-password" />
                        <TextField
                          label={`Type ${deletionPreview.confirmation_phrase} to confirm`}
                          value={deleteConfirmation}
                          onChange={event => setDeleteConfirmation(event.target.value)}
                          autoComplete="off"
                        />
                      </FormGrid>
                      <div className={styles.footer}>
                        <Button
                          variant="ghost-danger"
                          icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />}
                          disabled={deletingAccount || !deletePassword || deleteConfirmation !== deletionPreview.confirmation_phrase}
                          onClick={() => setDeleteConfirmOpen(true)}
                        >
                          Delete account
                        </Button>
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </div>
          </Card>

          <Card id="help" aria-labelledby="help-title">
            <CardHeader title={<span id="help-title">Help and onboarding</span>} />
            <div className={styles.cardBody}>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <h3 className={styles.subsectionTitle}>Getting started</h3>
                  <p className={styles.meta}>Review the full tournament workflow or reopen the welcome message.</p>
                </div>
                <div className={styles.buttons}>
                  <Link href="/help/getting-started" className={buttonClassName({ variant: 'secondary', size: 'sm' })}>Open guide</Link>
                  <Button size="sm" variant="secondary" onClick={openOnboarding}>Show welcome message</Button>
                </div>
              </div>
              <CardDivider />
              <div id="feedback-form" className={styles.group}>
                <div className={styles.rowText}>
                  <h3 className={styles.subsectionTitle}>Report a problem or request a feature</h3>
                  <p className={styles.meta}>Send a message to the BracketWorks team. Include steps to reproduce a problem when you can.</p>
                </div>
                <FormGrid>
                  <SelectField label="Message type" value={feedbackCategory} onChange={event => setFeedbackCategory(event.target.value as 'problem' | 'feature' | 'other')}>
                    <option value="problem">Report a problem</option>
                    <option value="feature">Request a feature</option>
                    <option value="other">Other</option>
                  </SelectField>
                  <TextField label="Subject" value={feedbackSubject} onChange={event => setFeedbackSubject(event.target.value)} maxLength={160} />
                  <TextAreaField
                    label="Message"
                    fullRow
                    value={feedbackMessage}
                    onChange={event => setFeedbackMessage(event.target.value)}
                    maxLength={5000}
                    rows={5}
                    helper={`${feedbackMessage.length} of 5000 characters`}
                  />
                </FormGrid>
                <div className={styles.footer}>
                  <Button variant="primary" onClick={submitFeedback} disabled={sendingFeedback || !feedbackSubject.trim() || !feedbackMessage.trim()}>
                    {sendingFeedback ? 'Sending...' : 'Send message'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card id="legal" padding="flush" aria-labelledby="legal-title">
            <CardHeader title={<span id="legal-title">Legal</span>} description="BracketWorks policies and acceptable use" />
            <ul className={styles.list}>
              <li>
                <button type="button" className={styles.linkRow} onClick={openLegalDisclosure}>
                  <span className={styles.rowTitle}>Periodic use disclosure</span>
                  <span className={styles.meta}>Review the disclosure and your current acceptance period.</span>
                </button>
              </li>
              {LEGAL_LINKS.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className={styles.linkRow}>
                    <span className={styles.rowTitle}>{link.title}</span>
                    <span className={styles.meta}>{link.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={sessionConfirm !== null}
        title={sessionConfirm?.kind === 'others'
          ? 'Sign out every other device?'
          : sessionConfirm?.session.is_current ? 'Sign out this device?' : `Sign out ${sessionConfirm?.session.device_nickname || 'this session'}?`}
        description={sessionConfirm?.kind === 'others' ? 'Your current session stays signed in.' : 'That device must sign in again to use BracketWorks.'}
        confirmLabel="Sign out"
        onCancel={() => setSessionConfirm(null)}
        onConfirm={() => {
          const pending = sessionConfirm;
          setSessionConfirm(null);
          if (!pending) return;
          if (pending.kind === 'others') void revokeOtherSessions();
          else void revokeSession(pending.session);
        }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        tone="danger"
        title="Permanently delete your account?"
        description="Your account is deactivated and your profile is anonymized. This cannot be undone."
        confirmLabel="Delete account"
        busy={deletingAccount}
        busyLabel="Deleting..."
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => { void deleteAccount(); }}
      />
    </Page>
  );
}
