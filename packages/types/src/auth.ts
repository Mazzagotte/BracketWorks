export interface AuthTokenResponse {
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  session_id: string;
  user_id: number;
  is_admin: boolean;
  first_name?: string | null;
  challenge_required?: boolean;
  challenge_type?: string | null;
  dev_notice_required?: boolean;
  dev_notice_version?: string;
}

export interface PersistAuthSessionInput {
  accessToken: string;
  userId: number | string;
  firstName?: string | null;
  isAdmin?: boolean;
  sessionId?: string | null;
}