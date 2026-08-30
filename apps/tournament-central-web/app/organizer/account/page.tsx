'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  changeMyPassword,
  getMyAccount,
  updateMyAccount,
  type OrganizerAccountProfile,
} from '@/components/organizer/organizerApi';
import styles from './account.module.css';

type ProfileForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  organization: string;
};

const emptyProfileForm: ProfileForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  organization: '',
};

function toProfileForm(profile: OrganizerAccountProfile): ProfileForm {
  return {
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    username: profile.username ?? '',
    email: profile.email ?? '',
    organization: profile.organization ?? '',
  };
}

export default function OrganizerAccountSettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<OrganizerAccountProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    signOutThisDevice: false,
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      router.replace('/login?expired=true');
      return;
    }
    getMyAccount(token)
      .then((account) => {
        setProfile(account);
        setProfileForm(toProfileForm(account));
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load account settings.'))
      .finally(() => setIsLoading(false));
  }, [router]);

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsSavingProfile(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const updated = await updateMyAccount(token, {
        first_name: profileForm.firstName.trim(),
        last_name: profileForm.lastName.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
        organization: profileForm.organization.trim() || null,
      });
      setProfile(updated);
      setProfileForm(toProfileForm(updated));
      if (updated.first_name) {
        localStorage.setItem('first_name', updated.first_name);
      }
      setProfileMessage('Profile updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setIsSavingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);
    try {
      await changeMyPassword(token, {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
        sign_out_current_session: passwordForm.signOutThisDevice,
      });
      if (passwordForm.signOutThisDevice) {
        sessionStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        router.replace('/login');
        return;
      }
      setPasswordMessage('Password updated. All other devices have been signed out.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', signOutThisDevice: false });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <h1>Account Settings</h1>
        <p>Manage your profile information and password.</p>
      </header>

      {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}
      {isLoading ? <section className={styles.loading}>Loading account settings...</section> : null}

      {!isLoading && !loadError ? (
        <>
          <section className={styles.card} aria-label="Profile">
            <h2>Profile</h2>
            {profile && !profile.email_verified ? (
              <p className={styles.infoBanner} role="status">Your email address is not verified.</p>
            ) : null}
            <form onSubmit={handleProfileSubmit} className={styles.form}>
              {profileError ? <p className={styles.error} role="alert">{profileError}</p> : null}
              {profileMessage ? <p className={styles.success} role="status">{profileMessage}</p> : null}
              <div className={styles.grid}>
                <label>
                  First name
                  <input
                    value={profileForm.firstName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={profileForm.lastName}
                    onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={profileForm.username}
                    onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                    required
                    minLength={3}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </label>
                <label className={styles.gridFull}>
                  Organization
                  <input
                    value={profileForm.organization}
                    onChange={(event) => setProfileForm((current) => ({ ...current, organization: event.target.value }))}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.card} aria-label="Change password">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              {passwordError ? <p className={styles.error} role="alert">{passwordError}</p> : null}
              {passwordMessage ? <p className={styles.success} role="status">{passwordMessage}</p> : null}
              <div className={styles.grid}>
                <label className={styles.gridFull}>
                  Current password
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={passwordForm.signOutThisDevice}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, signOutThisDevice: event.target.checked }))}
                />
                Also sign out this device
              </label>
              <p className={styles.hint}>All other devices are always signed out when you change your password.</p>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryButton} disabled={isSavingPassword}>
                  {isSavingPassword ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
