/**
 * Script : créer un compte admin Diwane
 * Usage  : node scripts/create-admin.js
 */
require('dotenv').config();
const {MongoClient} = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGO_URL = process.env.MONGODB_URL || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME   = process.env.MONGODB_DATABASE || 'immo-db';

const ADMIN = {
  prenom:       'Admin',
  nom:          'Diwane',
  email:        'admin@diwane.sn',
  telephone:    '+221770000000',
  mot_de_passe: 'Admin@Diwane2025', // ← change après le premier login
  role:         'admin',
};

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  // Vérifier si déjà existant
  const existing = await users.findOne({email: ADMIN.email});
  if (existing) {
    console.log(`⚠️  Admin déjà existant : ${ADMIN.email}`);
    console.log(`   ID : ${existing._id}`);
    await client.close();
    return;
  }

  const hash = await bcrypt.hash(ADMIN.mot_de_passe, 10);

  const result = await users.insertOne({
    prenom:          ADMIN.prenom,
    nom:             ADMIN.nom,
    email:           ADMIN.email,
    telephone:       ADMIN.telephone,
    mot_de_passe:    hash,
    role:            ADMIN.role,
    ville:           'Dakar',
    email_verifie:   true,
    actif:           true,
    abonnement:      {plan: 'gratuit', actif: false, prix_fcfa: 0},
    badges:          {verifie: false, top_courtier: false, ultra_reactif: false, photos_certifiees: false, premium: false},
    stats:           {nb_annonces_actives: 0, nb_annonces_total: 0, nb_transactions: 0, nb_vues_total: 0, nb_contacts_recus: 0, note_moyenne: 0, nb_avis: 0, taux_reponse: 0},
    limites:         {max_annonces: null, max_photos_par_annonce: null, visites_360_restantes: null, videos_restantes: null, boosts_gratuits_restants: 0, max_utilisateurs_agence: 1},
    createdAt:       new Date(),
    updatedAt:       new Date(),
  });

  console.log('✅ Admin créé !');
  console.log(`   Email    : ${ADMIN.email}`);
  console.log(`   Password : ${ADMIN.mot_de_passe}`);
  console.log(`   ID       : ${result.insertedId}`);
  console.log('');
  console.log('⚠️  Change le mot de passe après le premier login !');

  await client.close();
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
