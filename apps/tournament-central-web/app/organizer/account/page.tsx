'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardHeader, CheckboxField, FormGrid, Notice, Page, PageHeader, TextField } from '@bracketworks/ui';

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
      router.replace(`/login?expired=true&next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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

  const setProfileField = (key: keyof ProfileForm) => (event: { target: { value: string } }) => {
    const { value } = event.target;
    setProfileForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Page width="narrow">
      <PageHeader title="Account settings" description="Manage your profile information and password." />

      {loadError ? <Notice tone="danger" role="alert">{loadError}</Notice> : null}
      {isLoading ? <Notice tone="info">Loading account settings...</Notice> : null}

      {!isLoading && !loadError ? (
        <>
          <Card aria-label="Profile">
            <CardHeader title="Profile" />
            <form onSubmit={handleProfileSubmit} className={styles.form}>
              {profile && !profile.email_verified ? (
                <Notice tone="warning" role="status">Your email address is not verified.</Notice>
              ) : null}
              {profileError ? <Notice tone="danger" role="alert">{profileError}</Notice> : null}
              {profileMessage ? <Notice tone="success" role="status">{profileMessage}</Notice> : null}
              <FormGrid>
                <TextField label="First name" value={profileForm.firstName} onChange={setProfileField('firstName')} autoComplete="given-name" required />
                <TextField label="Last name" value={profileForm.lastName} onChange={setProfileField('lastName')} autoComplete="family-name" required />
                <TextField label="Username" value={profileForm.username} onChange={setProfileField('username')} autoComplete="username" required minLength={3} />
                <TextField label="Email" type="email" value={profileForm.email} onChange={setProfileField('email')} autoComplete="email" required />
                <TextField label="Organization" optional fullRow value={profileForm.organization} onChange={setProfileField('organization')} autoComplete="organization" />
              </FormGrid>
              <div className={styles.actions}>
                <Button type="submit" variant="primary" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save profile'}
                </Button>
              </div>
            </form>
          </Card>

          <Card aria-label="Change password">
            <CardHeader title="Change password" description="All other devices are signed out when you change your password." />
            <form onSubmit={handlePasswordSubmit} className={styles.form}>
              {passwordError ? <Notice tone="danger" role="alert">{passwordError}</Notice> : null}
              {passwordMessage ? <Notice tone="success" role="status">{passwordMessage}</Notice> : null}
              <FormGrid>
                <TextField
                  label="Current password"
                  type="password"
                  fullRow
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
                <TextField
                  label="New password"
                  type="password"
                  helper="At least 8 characters."
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </FormGrid>
              <CheckboxField
                label="Also sign out this device"
                checked={passwordForm.signOutThisDevice}
                onChange={(event) => setPasswordForm((current) => ({ ...current, signOutThisDevice: event.target.checked }))}
              />
              <div className={styles.actions}>
                <Button type="submit" variant="primary" disabled={isSavingPassword}>
                  {isSavingPassword ? 'Saving...' : 'Update password'}
                </Button>
              </div>
            </form>
          </Card>
        </>
      ) : null}
    </Page>
  );
}
