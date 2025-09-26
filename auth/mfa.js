// auth/mfa.js
import {
  getAuth,
  signInWithEmailAndPassword,
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
} from 'firebase/auth';

// keep pending secret in-memory between steps
const _pending = new Map();

/** Start enrollment: returns otpauth:// URI for QR/Authenticator */
export async function startTotpEnrollment(user, { accountName, issuer, displayName } = {}) {
  if (!user) throw new Error('No user for TOTP enrollment');
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);

  const acct = accountName ?? user.email ?? user.uid;
  const iss = issuer ?? 'BabyTracker';
  const otpauthUrl = secret.generateQrCodeUrl(acct, iss);

  const name = displayName ?? 'Authenticator app';
  _pending.set(user.uid, { secret, displayName: name });

  return { otpauthUrl, enrollmentDisplayName: name };
}

/** Finish enrollment with the 6-digit code */
export async function finishTotpEnrollment(user, code) {
  const pending = _pending.get(user.uid);
  if (!pending) throw new Error('No pending TOTP enrollment session');
  const { secret, displayName } = pending;

  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  await multiFactor(user).enroll(assertion, displayName);
  _pending.delete(user.uid);
}

/** Sign in; if MFA required, throws auth/multi-factor-auth-required */
export async function signInOrThrowMfa(email, password) {
  const auth = getAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Detect MFA challenge error */
export function isTotpChallenge(err) {
  return !!err && typeof err === 'object' && err.code === 'auth/multi-factor-auth-required';
}

/** Resolve TOTP sign-in by supplying the 6-digit code */
export async function resolveTotpSignIn(mfaError, code) {
  const auth = getAuth();
  const resolver = getMultiFactorResolver(auth, mfaError);
  const totpHint = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!totpHint) throw new Error('No TOTP factor on this account');

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint, code);
  const cred = await resolver.resolveSignIn(assertion);
  return cred.user;
}
