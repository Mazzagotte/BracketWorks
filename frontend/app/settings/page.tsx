"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePageHeader } from '../lib/header-context';
import { useToast } from '../components/Toast';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { calculatePasswordStrengthPercent, getPasswordRequirementChecks, hasStrongPassword } from '../lib/auth/validation';
import PasswordStrengthPanel from '../components/PasswordStrengthPanel';
import styles from './settings.module.css';

type AccountProfile = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  organization: string;
  email_verified?: boolean;
  email_verified_at?: string | null;
};

type SessionInfo = {
  session_id: string;
  issued_at: string;
  last_seen_at: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at?: string | null;
  device_nickname?: string | null;
  region_hint?: string | null;
  risk_score?: number;
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
  const { updateUser, logout } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [profile, setProfile] = useState<AccountProfile>(emptyProfile);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [logoutAfterPasswordChange, setLogoutAfterPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const verifiedOnLabel = formatVerifiedDate(profile.email_verified_at);

  usePageHeader({
    title: 'Settings',
    subtitle: 'Account',
    actions: undefined,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const me = await apiClient.get<AccountProfile & { id: number; is_admin: boolean }>('/api/v1/users/me', false);
        setProfile({
          first_name: me.first_name || '',
          last_name: me.last_name || '',
          username: me.username || '',
          email: me.email || '',
          organization: me.organization || '',
          email_verified: Boolean(me.email_verified),
          email_verified_at: me.email_verified_at || null,
        });
      } catch (err) {
        addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load account settings', duration: 5000 });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [addToast]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const payload = await apiClient.get<{ sessions: SessionInfo[] }>('/api/v1/users/sessions?include_revoked=false', false);
      setSessions(payload.sessions || []);
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load sessions', duration: 5000 });
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!profile.username.trim()) {
      addToast({ type: 'warning', message: 'Username is required.', duration: 3000 });
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

      setProfile({
        first_name: updated.first_name || '',
        last_name: updated.last_name || '',
        username: updated.username || '',
        email: updated.email || '',
        organization: updated.organization || '',
        email_verified: Boolean(updated.email_verified),
        email_verified_at: updated.email_verified_at || null,
      });

      if (updated.first_name) {
        localStorage.setItem('first_name', updated.first_name);
        updateUser({ name: updated.first_name });
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
      });

      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      addToast({ type: 'success', message: 'Password updated. A confirmation email was sent to your account.', duration: 3500 });

      if (logoutAfterPasswordChange) {
        addToast({ type: 'info', message: 'Signing out for security. Please log in with your new password.', duration: 3000 });
        logout();
        window.location.href = '/login';
      }
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update password', duration: 5000 });
    } finally {
      setSavingPassword(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await apiClient.post('/api/v1/users/sessions/revoke', { session_id: sessionId });
      addToast({ type: 'success', message: 'Session revoked.', duration: 2500 });
      const activeSessionId = typeof window !== 'undefined' ? localStorage.getItem('session_id') : null;
      if (activeSessionId && activeSessionId === sessionId) {
        addToast({ type: 'info', message: 'Current session revoked. Please sign in again.', duration: 3000 });
        logout();
        window.location.href = '/login';
        return;
      }
      await loadSessions();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to revoke session', duration: 5000 });
    } finally {
      setRevokingSessionId(null);
    }
  };

  if (loading) {
    return <div className={styles.pageContainer}>Loading account settings...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Profile</h2>
        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>First Name</div>
          </div>
          <input
            className={styles.input}
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
            value={profile.username}
            onChange={e => handleProfileChange('username', e.target.value)}
            placeholder="Username"
          />
        </div>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Email</div>
          </div>
          <input
            className={styles.input}
            type="email"
            value={profile.email}
            onChange={e => handleProfileChange('email', e.target.value)}
            placeholder="Email"
          />
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
                className="ds-btn ds-btn-outline ds-btn-sm"
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
            value={profile.organization}
            onChange={e => handleProfileChange('organization', e.target.value)}
            placeholder="Organization"
          />
        </div>

        <div className={styles.actionRow}>
          <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Security</h2>

        <div className={styles.optionRow}>
          <div className={styles.optionText}>
            <div className={styles.optionTitle}>Current Password</div>
          </div>
          <div className={styles.passwordFieldWrap}>
            <input
              className={styles.input}
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordForm.current_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
              placeholder="Current password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
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
              type={showPasswords.next ? 'text' : 'password'}
              value={passwordForm.new_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
              placeholder="New password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
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
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordForm.confirm_password}
              onChange={e => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              className={styles.visibilityBtn}
              onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
            >
              {showPasswords.confirm ? 'Hide' : 'Show'}
            </button>
          </div>
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

        <div className={styles.actionRow}>
          <button type="button" className="ds-btn ds-btn-primary ds-btn-sm" onClick={updatePassword} disabled={savingPassword}>
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Active Sessions</h2>
        {loadingSessions ? <div className={styles.sessionEmpty}>Loading sessions...</div> : null}
        {!loadingSessions && sessions.length === 0 ? (
          <div className={styles.sessionEmpty}>No active sessions found.</div>
        ) : null}
        {!loadingSessions && sessions.map(session => {
          const localSessionId = typeof window !== 'undefined' ? localStorage.getItem('session_id') : null;
          const isCurrent = localSessionId === session.session_id;
          return (
            <div className={styles.sessionRow} key={session.session_id}>
              <div className={styles.sessionMeta}>
                <div className={styles.sessionTitle}>
                  {session.device_nickname || 'Unknown device'} {isCurrent ? '(This device)' : ''}
                </div>
                <div className={styles.sessionHint}>Region: {session.region_hint || 'unknown'} | Risk: {(session.risk_score ?? 0).toFixed(2)}</div>
                <div className={styles.sessionHint}>Last seen: {new Date(session.last_seen_at).toLocaleString()}</div>
              </div>
              <button
                type="button"
                className="ds-btn ds-btn-outline ds-btn-sm"
                onClick={() => revokeSession(session.session_id)}
                disabled={revokingSessionId === session.session_id}
              >
                {revokingSessionId === session.session_id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          );
        })}
      </section>

    </div>
  );
}
