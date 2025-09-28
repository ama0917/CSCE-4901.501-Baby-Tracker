// scripts/print-user-mfa.mjs
import admin from 'firebase-admin';
import fs from 'fs';

const saPath = './backend/firebase-service-account.json';
const UID = 'WnCdDfsaJwhNir1Rx43chAfepI03'; // your test user uid

if (!fs.existsSync(saPath)) { console.error('Missing service account'); process.exit(1); }
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const u = await auth.getUser(UID);
console.log('emailVerified:', u.emailVerified);
console.log('multiFactor.enrolledFactors:', (u.multiFactor?.enrolledFactors || []).map(f => ({
  uid: f.uid, factorId: f.factorId, displayName: f.displayName, enrollmentTime: f.enrollmentTime
})));
