// scripts/remove-user-totp.mjs
import admin from 'firebase-admin';
import fs from 'fs';

const saPath = './backend/firebase-service-account.json';
const UID = process.argv[2] || 'WnCdDfsaJwhNir1Rx43chAfepI03'; // pass UID as argv[2] or edit this

if (!fs.existsSync(saPath)) {
  console.error('Missing service account at', saPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();

try {
  const before = (await auth.getUser(UID)).multiFactor?.enrolledFactors ?? [];
  console.log('BEFORE factors:', before.map(f => ({ uid: f.uid, factorId: f.factorId })));

  // Remove ALL enrolled second factors (clears TOTP)
  await auth.updateUser(UID, { multiFactor: { enrolledFactors: [] } });

  const after = (await auth.getUser(UID)).multiFactor?.enrolledFactors ?? [];
  console.log('AFTER factors:', after.map(f => ({ uid: f.uid, factorId: f.factorId })));
  console.log('Done.');
} catch (e) {
  console.error('Failed to remove TOTP for UID', UID, e?.errorInfo ?? e);
  process.exit(1);
}
