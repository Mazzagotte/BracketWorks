"use client";

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageHeader } from '../lib/header-context';
import { useToast } from '../components/Toast';
import { apiClient } from '../lib/api';
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

  usePageHeader({
    title: 'Settings',
    subtitle: 'Account',
    actions: undefined,
  });

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
          <a href="#account">Account</a><a href="#security">Security</a><a href="#help">Help</a><a href="#legal">Legal</a>
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
