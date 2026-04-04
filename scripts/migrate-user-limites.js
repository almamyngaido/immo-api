/**
 * Migration : mettre à jour les limites des users existants selon leur plan
 * Usage : node scripts/migrate-user-limites.js
 */
const {MongoClient} = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME   = 'immo-db';

function getLimitesParPlan(plan) {
  switch (plan) {
    case 'premium':
      return {
        max_annonces:             null,
        max_photos_par_annonce:   15,
        visites_360_restantes:    5,
        videos_restantes:         2,
        boosts_gratuits_restants: 1,
        max_utilisateurs_agence:  1,
      };
    case 'pro':
      return {
        max_annonces:             null,
        max_photos_par_annonce:   null,
        visites_360_restantes:    null,
        videos_restantes:         null,
        boosts_gratuits_restants: 3,
        max_utilisateurs_agence:  7,
      };
    case 'gratuit':
    default:
      return {
        max_annonces:             5,
        max_photos_par_annonce:   10,
        visites_360_restantes:    0,
        videos_restantes:         0,
        boosts_gratuits_restants: 0,
        max_utilisateurs_agence:  1,
      };
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('✅ Connecté à MongoDB');

    const db    = client.db(DB_NAME);
    const users = db.collection('users');

    for (const plan of ['gratuit', 'premium', 'pro']) {
      const limites = getLimitesParPlan(plan);

      const setFields = {};
      for (const [k, v] of Object.entries(limites)) {
        setFields[`limites.${k}`] = v;
      }
      if (plan === 'premium') setFields['abonnement.prix_fcfa'] = 10000;
      if (plan === 'pro')     setFields['abonnement.prix_fcfa'] = 35000;
      if (plan === 'gratuit') setFields['abonnement.prix_fcfa'] = 0;

      const result = await users.updateMany(
        {role: 'courtier', 'abonnement.plan': plan},
        {$set: setFields},
      );
      console.log(`Plan ${plan}: ${result.modifiedCount} courtiers mis à jour`);
    }

    // Vérification
    const sample = await users.find(
      {role: 'courtier'},
      {projection: {prenom: 1, 'abonnement.plan': 1, limites: 1}},
    ).limit(5).toArray();

    console.log('\n📋 Échantillon après migration :');
    for (const u of sample) {
      console.log(`  ${u.prenom} — plan: ${u.abonnement?.plan}, max_annonces: ${u.limites?.max_annonces}`);
    }

    console.log('\n✅ Migration terminée');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
