/**
 * Script : vérifier manuellement l'email (+ badge CNI pour un compte donné)
 * des comptes de test créés pendant les tests manuels.
 * Usage : node scripts/fix-test-accounts.js
 */
require('dotenv').config();
const {MongoClient} = require('mongodb');

const MONGO_URL = process.env.MONGODB_URL || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME   = process.env.MONGODB_DATABASE || 'immo-db';

// Comptes de test à marquer email_verifie=true
const EMAILS_A_VERIFIER = [
  'fatou.diop.courtier@example.com',
  'moussa.sow.courtier@example.com',
  'aissatou.ba.courtier@example.com',
  'ibrahima.fall.acheteur@example.com',
  'khady.diagne.acheteur@example.com',
  'almamyngaido@gmail.com',
];

// Compte(s) à marquer aussi vérifié CNI (badge + statut)
const EMAILS_BADGE_CNI = [
  'almamyngaido@gmail.com',
];

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  for (const email of EMAILS_A_VERIFIER) {
    const user = await users.findOne({email});
    if (!user) {
      console.log(`⚠️  Introuvable : ${email}`);
      continue;
    }

    const update = {email_verifie: true, updatedAt: new Date()};

    if (EMAILS_BADGE_CNI.includes(email)) {
      update.badges = {...(user.badges || {}), verifie: true};
      update.verification = {
        ...(user.verification || {}),
        statut: 'verifie',
        date_validation: new Date(),
      };
    }

    await users.updateOne({_id: user._id}, {$set: update});
    console.log(`✅ ${email} — email vérifié${EMAILS_BADGE_CNI.includes(email) ? ' + badge CNI' : ''}`);
  }

  await client.close();
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
