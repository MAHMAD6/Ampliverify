export type AuthenticatedActor = {
  userId: string;
  authSubject: string;
  email: string;
  /** Two-factor authentication is enabled on the account (from the auth token). */
  mfa?: boolean;
};
