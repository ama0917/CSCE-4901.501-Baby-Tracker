// scripts/print-project-mfa.mjs (already have)
import admin from 'firebase-admin';
import fs from 'fs';
const saPath = './backend/firebase-service-account.json';
if (!fs.existsSync(saPath)) { console.error('Missing service account'); process.exit(1); }
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();
const cfg = await auth.projectConfigManager().getProjectConfig();
console.log(JSON.stringify(cfg.multiFactorConfig ?? {}, null, 2));
