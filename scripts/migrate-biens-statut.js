/**
 * Migration : passer tous les biens en_attente → publie
 * Exécuter UNE SEULE FOIS : node scripts/migrate-biens-statut.js
 */
const { MongoClient } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'immo-db';

async function migrate() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  console.log(`✅ Connecté à ${MONGODB_URL}/${MONGODB_DATABASE}`);

  const db = client.db(MONGODB_DATABASE);
  const biens = db.collection('biens');
  const users = db.collection('users');

  // 1. Passer en_attente → publie
  const dateExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 jours
  const result = await biens.updateMany(
    { statut: 'en_attente' },
    {
      $set: {
        statut: 'publie',
        date_publication: new Date(),
        date_expiration: dateExpiration,
      }
    }
  );
  console.log(`✅ ${result.modifiedCount} annonce(s) passée(s) en statut 'publie'`);

  // 2. Vérification
  const nbPublie    = await biens.countDocuments({ statut: 'publie' });
  const nbEnAttente = await biens.countDocuments({ statut: 'en_attente' });
  console.log(`📊 publie=${nbPublie}  en_attente=${nbEnAttente} (doit être 0)`);

  // 3. Recalculer nb_annonces_actives pour chaque courtier
  const courtiers = await users.find({ role: 'courtier' }).toArray();
  let updated = 0;
  for (const courtier of courtiers) {
    const id = courtier._id.toString();
    const nb = await biens.countDocuments({
      courtier_id: id,
      statut: { $in: ['publie', 'en_attente'] },
    });
    await users.updateOne(
      { _id: courtier._id },
      { $set: { 'stats.nb_annonces_actives': nb } }
    );
    updated++;
  }
  console.log(`✅ Stats recalculées pour ${updated} courtier(s)`);

  await client.close();
  console.log('🏁 Migration terminée.');
}

migrate().catch(err => {
  console.error('❌ Erreur migration :', err);
  process.exit(1);
});
