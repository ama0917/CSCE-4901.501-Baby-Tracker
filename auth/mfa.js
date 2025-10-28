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
export async function finishTotpEnrollment(user, code) {
  if (!user) throw new Error('No user for TOTP enrollment finish');
  const pending = _pending.get(user.uid);
  if (!pending) throw new Error('No pending TOTP enrollment session');
  const { secret, displayName } = pending;

  console.log('[MFA] finishTotpEnrollment for uid=', user.uid, 'displayName=', displayName);

  // Build the assertion from the secret + one-time code
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code);
  console.log('[MFA] created assertion, enrolling…');

  try {
    await multiFactor(user).enroll(assertion, displayName);
    console.log('[MFA] enroll() resolved');
  } catch (e) {
    console.warn('[MFA] enroll() FAILED', e?.code, e?.message, e?.customData);
    
    // Provide user-friendly error messages
    if (e?.code === 'auth/invalid-verification-code') {
      const error = new Error('The code you entered is incorrect. Please check your authenticator app and try again.');
      error.code = 'auth/invalid-verification-code';
      throw error;
    } else if (e?.code === 'auth/code-expired') {
      const error = new Error('This code has expired. Please enter the current code from your authenticator app.');
      error.code = 'auth/code-expired';
      throw error;
    } else if (e?.code === 'auth/session-expired') {
      const error = new Error('Your session has expired. Please start the setup process again.');
      error.code = 'auth/session-expired';
      throw error;
    } else if (e?.code === 'auth/requires-recent-login') {
      const error = new Error('For security, please sign out and back in to enable two-step verification.');
      error.code = 'auth/requires-recent-login';
      throw error;
    } else if (e?.code === 'auth/too-many-requests') {
      const error = new Error('Too many attempts. Please wait a moment and try again.');
      error.code = 'auth/too-many-requests';
      throw error;
    } else {
      // Generic error for unknown issues
      const error = new Error('Could not complete setup. Please try again.');
      error.code = e?.code || 'auth/unknown';
      throw error;
    }
  }

  _pending.delete(user.uid);
  await user.getIdToken(true);

  // Reload and report factor count
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
  if (!totpHint) {
    const error = new Error('No authenticator app linked to this account.');
    error.code = 'auth/no-totp-factor';
    throw error;
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
  console.log('[MFA] created sign-in assertion, resolving…');

  try {
    const cred = await resolver.resolveSignIn(assertion);
    console.log('[MFA] resolveSignIn() ok for uid=', cred.user?.uid);
    return cred.user;
  } catch (e) {
    console.warn('[MFA] resolveSignIn() FAILED', e?.code, e?.message);
    
    // Provide user-friendly error messages for sign-in
    if (e?.code === 'auth/invalid-verification-code') {
      const error = new Error('Incorrect code. Please enter the current 6-digit code from your authenticator app.');
      error.code = 'auth/invalid-verification-code';
      throw error;
    } else if (e?.code === 'auth/code-expired') {
      const error = new Error('This code has expired. Please enter the current code.');
      error.code = 'auth/code-expired';
      throw error;
    } else if (e?.code === 'auth/too-many-requests') {
      const error = new Error('Too many failed attempts. Please wait a few minutes and try again.');
      error.code = 'auth/too-many-requests';
      throw error;
    } else if (e?.code === 'auth/session-expired') {
      const error = new Error('Your session has expired. Please sign in again.');
      error.code = 'auth/session-expired';
      throw error;
    } else {
      const error = new Error('Could not verify code. Please try again.');
      error.code = e?.code || 'auth/unknown';
      throw error;
    }
  }
}

