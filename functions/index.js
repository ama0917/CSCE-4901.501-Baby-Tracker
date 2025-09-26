// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// Config kept minimal—only what's used
const MAX_ATTEMPTS = 5;

function hash(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// TEMP: one-time endpoint to enable TOTP at the project level
exports.enableTotp = functions.https.onRequest(async (req, res) => {
  try {
    await admin.auth().projectConfigManager().updateProjectConfig({
      multiFactorConfig: {
        providerConfigs: [
          {
            state: 'ENABLED',
            totpProviderConfig: {
              // Accept current + 5 adjacent 30s windows (0–10 allowed)
              adjacentIntervals: 5,
            },
          },
        ],
      },
    });
    res.status(200).send('TOTP MFA enabled');
  } catch (e) {
    console.error(e);
    res.status(500).send(String(e));
  }
});

/**
 * verifyOtp
 * Callable: data = { code }
 * Checks latest active challenge for caller, compares hash + expiry, increments attempts.
 * On success: marks challenge verified and returns ok.
 */
exports.verifyOtp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }

  const uid = context.auth.uid;
  const code = (data && data.code ? data.code : '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new functions.https.HttpsError('invalid-argument', 'Code must be 6 digits');
  }

  const now = admin.firestore.Timestamp.now();
  const q = await db
    .collection('otpChallenges')
    .where('uid', '==', uid)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (q.empty) {
    throw new functions.https.HttpsError('not-found', 'No active challenge');
  }

  const docSnap = q.docs[0];
  const ch = docSnap.data();

  if (ch.attempts >= MAX_ATTEMPTS) {
    await docSnap.ref.update({ status: 'expired' });
    throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts');
  }

  if (now.toMillis() > ch.expiresAt.toMillis()) {
    await docSnap.ref.update({ status: 'expired' });
    throw new functions.https.HttpsError('deadline-exceeded', 'Code expired');
  }

  const ok = hash(code) === ch.codeHash;
  if (!ok) {
    await docSnap.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    throw new functions.https.HttpsError('permission-denied', 'Invalid code');
  }

  await docSnap.ref.update({ status: 'verified', verifiedAt: now });

  // Optional marker for client gating
  await db.collection('Users').doc(uid).set({ lastMfaOkAt: now }, { merge: true });

  return { ok: true };
});

// Example HTTP function (kept commented; safe for lint)
// exports.helloWorld = functions.https.onRequest((req, res) => {
//   res.send("Hello from Firebase!");
// });
