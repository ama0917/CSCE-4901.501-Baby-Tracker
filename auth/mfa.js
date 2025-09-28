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
  console.log('[MFA] startTotpEnrollment for uid=', user.uid);

  // MUST have a recent sign-in and verified email before this point (you gated it in Settings)
  const session = await multiFactor(user).getSession();
  console.log('[MFA] got session');

  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  console.log('[MFA] generated secret');

  const acct = accountName ?? user.email ?? user.uid;
  const iss = issuer ?? 'BabyTracker';
  const otpauthUrl = secret.generateQrCodeUrl(acct, iss);

  const name = displayName ?? 'Authenticator app';
  _pending.set(user.uid, { secret, displayName: name });
  console.log('[MFA] pending secret stored for uid=', user.uid);

  return { otpauthUrl, enrollmentDisplayName: name };
}

/** Finish enrollment with the 6-digit code */
export async function finishTotpEnrollment(user, code) {
  if (!user) throw new Error('No user for TOTP enrollment finish');
  const pending = _pending.get(user.uid);
  if (!pending) throw new Error('No pending TOTP enrollment session');
  const { secret, displayName } = pending;

  console.log('[MFA] finishTotpEnrollment for uid=', user.uid, 'displayName=', displayName);

  // Build the assertion from the secret + one-time code
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  console.log('[MFA] created assertion, enrolling…');

  // This call should throw on bad code or stale session
  // inside finishTotpEnrollment, replace the enroll call with this:
    try {
      await multiFactor(user).enroll(assertion, displayName);
      console.log('[MFA] enroll() resolved');
    } catch (e) {
      console.warn('[MFA] enroll() FAILED', e?.code, e?.message, e?.customData);
      throw e;
    }


  _pending.delete(user.uid);

  await user.getIdToken(true);


  // Reload and report factor count so callers/tests can log it
  await user.reload();
  const count = (user.multiFactor?.enrolledFactors || []).length;
  console.log('[MFA] enrolledFactors after enroll =', count);

  return count;
}

/** Convenience sign-in that may throw MFA-required error */
export async function signInOrThrowMfa(auth, email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}


/** Detect MFA challenge error */
export function isTotpChallenge(err) {
  return !!err && typeof err === 'object' && err.code === 'auth/multi-factor-auth-required';
}

/** Resolve TOTP sign-in by supplying the 6-digit code */
export async function resolveTotpSignIn(auth, mfaError, code) {
  const resolver = getMultiFactorResolver(auth, mfaError);
  console.log('[MFA] resolver hints =', resolver.hints?.map(h => ({ factorId: h.factorId, uid: h.uid })));

  const totpHint = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!totpHint) throw new Error('No TOTP factor on this account');

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
  console.log('[MFA] created sign-in assertion, resolving…');

  const cred = await resolver.resolveSignIn(assertion);
  console.log('[MFA] resolveSignIn() ok for uid=', cred.user?.uid);
  return cred.user;
}

