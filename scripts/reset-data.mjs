/**
 * Script de remise à zéro — supprime tous les users (sauf admin) et tous les biens
 * Usage : node scripts/reset-data.mjs
 */
import pkg from 'mongodb';
const { MongoClient, ObjectId } = pkg;
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URL = process.env.MONGODB_URL ?? 'mongodb://localhost:27017';
const MONGODB_DB  = process.env.MONGODB_DATABASE ?? 'immo-db';
const ADMIN_ID    = '69d0eb9ea77e884a4cd45f32';

async function run() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  console.log(`✅ Connecté à ${MONGODB_URL} / ${MONGODB_DB}`);

  const db = client.db(MONGODB_DB);

  // ── Supprimer tous les users sauf l'admin ─────────────────────────────────
  const usersResult = await db.collection('users').deleteMany({
    _id: { $ne: new ObjectId(ADMIN_ID) },
  });
  console.log(`🗑️  Users supprimés : ${usersResult.deletedCount}`);

  // ── Supprimer tous les biens ───────────────────────────────────────────────
  const biensResult = await db.collection('biens').deleteMany({});
  console.log(`🗑️  Biens supprimés  : ${biensResult.deletedCount}`);

  // ── Nettoyer les collections liées (favoris, contacts, avis…) ─────────────
  const favoris    = await db.collection('favoris').deleteMany({});
  const contacts   = await db.collection('demandes_contact').deleteMany({});
  const avis       = await db.collection('avis').deleteMany({});
  const alertes    = await db.collection('alertes_recherche').deleteMany({});
  console.log(`🗑️  Favoris : ${favoris.deletedCount}, Contacts : ${contacts.deletedCount}, Avis : ${avis.deletedCount}, Alertes : ${alertes.deletedCount}`);

  await client.close();
  console.log('✅ Remise à zéro terminée.');
}

run().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
