/**
 * DIWANE — Storage Service
 *
 * STORAGE_DRIVER=local    → disque local uploads/cni/  (dev)
 * STORAGE_DRIVER=firebase → Firebase Storage bucket privé (prod)
 *
 * Par défaut : local si NODE_ENV !== 'production', firebase sinon.
 */
import {injectable} from '@loopback/core';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ── Driver actif ──────────────────────────────────────────────────────────────
function getDriver(): 'local' | 'firebase' {
  const explicit = process.env.STORAGE_DRIVER;
  if (explicit === 'firebase') return 'firebase';
  if (explicit === 'local')    return 'local';
  return process.env.NODE_ENV === 'production' ? 'firebase' : 'local';
}

// ── Répertoire local ──────────────────────────────────────────────────────────
const LOCAL_CNI_DIR = path.join(__dirname, '../../uploads/cni');
if (!fs.existsSync(LOCAL_CNI_DIR)) fs.mkdirSync(LOCAL_CNI_DIR, {recursive: true});

// ── Init Firebase (uniquement si driver=firebase) ─────────────────────────────
let _fbReady = false;

function initFirebase(): void {
  if (getDriver() !== 'firebase') return;
  if (_fbReady || admin.apps.length > 0) { _fbReady = true; return; }

  const bucket      = process.env.FIREBASE_STORAGE_BUCKET;
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const accountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!bucket) throw new Error('[Storage] FIREBASE_STORAGE_BUCKET manquant');

  let credential: admin.credential.Credential;
  if (accountPath && fs.existsSync(accountPath)) {
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(accountPath, 'utf-8')));
  } else if (accountJson) {
    credential = admin.credential.cert(JSON.parse(accountJson));
  } else {
    throw new Error('[Storage] Aucune credential Firebase trouvée');
  }

  admin.initializeApp({credential, storageBucket: bucket});
  _fbReady = true;
  console.log(`[Storage] Firebase — bucket: ${bucket}`);
}

// ── Token local signé (HMAC-SHA256, 1h) ──────────────────────────────────────
const TOKEN_SECRET = process.env.JWT_SECRET ?? 'dev-local-secret';

function signLocalToken(filePath: string): string {
  const expires = Date.now() + 60 * 60 * 1000;
  const payload = `${filePath}|${expires}`;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({filePath, expires, sig})).toString('base64url');
}

export function verifyLocalToken(token: string): string | null {
  try {
    const {filePath, expires, sig} = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (Date.now() > expires) return null;
    const expected = crypto.createHmac('sha256', TOKEN_SECRET)
      .update(`${filePath}|${expires}`).digest('hex');
    return sig === expected ? filePath : null;
  } catch {
    return null;
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

@injectable()
export class FirebaseStorageService {
  private readonly driver: 'local' | 'firebase';

  constructor() {
    this.driver = getDriver();
    if (this.driver === 'firebase') {
      initFirebase();
    } else {
      console.log('[Storage] Mode LOCAL → uploads/cni/');
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async uploadCniDocument(params: {
    localFilePath: string;
    userId: string;
    documentType: 'cni_recto' | 'cni_verso' | 'registre_commerce';
    mimeType: string;
  }): Promise<string> {
    const ext = path.extname(params.localFilePath) || '.jpg';
    const filename = `${params.documentType}_${Date.now()}${ext}`;

    if (this.driver === 'firebase') {
      const dest = `cni/${params.userId}/${filename}`;
      await admin.storage().bucket().upload(params.localFilePath, {
        destination: dest,
        metadata: {contentType: params.mimeType},
      });
      fs.unlink(params.localFilePath, () => {});
      return `firebase:${dest}`;
    }

    // Local
    const userDir = path.join(LOCAL_CNI_DIR, params.userId);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, {recursive: true});
    const dest = path.join(userDir, filename);
    fs.copyFileSync(params.localFilePath, dest);
    fs.unlink(params.localFilePath, () => {});
    return `local:cni/${params.userId}/${filename}`;
  }

  // ── URL signée 1h ──────────────────────────────────────────────────────────

  async genererUrlSignee(storagePath: string): Promise<string> {
    if (this.driver === 'firebase' || storagePath.startsWith('firebase:')) {
      const gcsPath = storagePath.replace(/^firebase:/, '');
      const [url] = await admin.storage().bucket().file(gcsPath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      return url;
    }

    // Local : token signé → endpoint /api/admin/cni/view/:token
    const relativePath = storagePath.replace(/^local:/, '');
    const token = signLocalToken(relativePath);
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return `${base}/api/admin/cni/view/${token}`;
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  async supprimerDocument(storagePath: string): Promise<void> {
    try {
      if (storagePath.startsWith('firebase:')) {
        await admin.storage().bucket().file(storagePath.replace('firebase:', '')).delete();
      } else {
        const abs = path.join(path.join(__dirname, '../../uploads'),
          storagePath.replace(/^local:/, ''));
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
    } catch (_) {}
  }

  isConfigured(): boolean { return true; }
}
