// enable-totp.mjs  (replace contents)
import admin from 'firebase-admin';
import fs from 'fs';

const saPath = './backend/firebase-service-account.json';
if (!fs.existsSync(saPath)) { console.error('Missing service account at', saPath); process.exit(1); }
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();

await auth.projectConfigManager().updateProjectConfig({
  multiFactorConfig: {
    state: 'ENABLED', // global MFA switch
    providerConfigs: [
      {
        state: 'ENABLED',
        totpProviderConfig: { adjacentIntervals: 1 },
      },
    ],
  },
});

console.log('✅ MFA global state ENABLED; TOTP provider ENABLED (no factorIds)');
