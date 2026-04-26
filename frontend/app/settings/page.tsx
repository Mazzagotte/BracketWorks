"use client";

import { useEffect, useMemo, useState } from 'react';
import { usePageHeader } from '../lib/header-context';
import { useToast } from '../components/Toast';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth-context';
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

const emptyProfile: AccountProfile = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  organization: '',
  email_verified: false,
  email_verified_at: null,
};

export default function SettingsPage() {
  const { updateUser, logout } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profile, setProfile] = useState<AccountProfile>(emptyProfile);
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

  const passwordStrength = useMemo(() => {
    const value = passwordForm.new_password || '';
    if (!value) return { label: 'Enter a new password', score: 0 };

    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    if (score <= 2) return { label: 'Weak', score: 1 };
    if (score <= 4) return { label: 'Medium', score: 2 };
    return { label: 'Strong', score: 3 };
  }, [passwordForm.new_password]);

  const handleProfileChange = (key: keyof AccountProfile, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!profile.username.trim()) {
      addToast({ type: 'warning', message: 'Username is required.', duration: 3000 });
      return;
    }

    setSavingProfile(true);
    try {
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

      addToast({ type: 'success', message: 'Account updated.', duration: 2500 });
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

    if (passwordForm.new_password.length < 8) {
      addToast({ type: 'warning', message: 'New password must be at least 8 characters.', duration: 3000 });
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
      addToast({ type: 'success', message: 'Password updated successfully.', duration: 2500 });

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
            <div className={styles.optionHint}>At least 8 characters.</div>
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
          <div className={styles.meterWrap}>
            <div className={`${styles.meterBar} ${passwordStrength.score >= 1 ? styles.meterOn : ''}`} />
            <div className={`${styles.meterBar} ${passwordStrength.score >= 2 ? styles.meterOn : ''}`} />
            <div className={`${styles.meterBar} ${passwordStrength.score >= 3 ? styles.meterOn : ''}`} />
            <span className={styles.meterLabel}>{passwordStrength.label}</span>
          </div>
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

    </div>
  );
}
