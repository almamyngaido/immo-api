/**
 * SCRIPT DE MIGRATION — France B2B → Sénégal B2C
 *
 * Ce script transforme les données existantes :
 *   utilisateurs → users       (avec mapping des champs)
 *   bienimmos    → biens       (avec mapping + suppression champs FR)
 *   paniers      → favoris     (panier B2B → liste favoris B2C)
 *   messages     → messages    (avec nouveau schema conversation_id)
 *
 * USAGE :
 *   npx ts-node src/migrations/migrate-to-sn.ts
 *
 * PRÉREQUIS :
 *   - Variable d'environnement MONGO_URL ou MongoDB local sur 27017
 *   - Exécuter UNE SEULE FOIS (le script vérifie s'il a déjà tourné)
 *
 * SÉCURITÉ :
 *   - Les anciennes collections sont renommées avec suffix _legacy (pas supprimées)
 *   - Un backup manuel est recommandé avant exécution
 */

// @ts-nocheck — Script de migration standalone, pas de types MongoDB stricts requis
import * as dotenv from 'dotenv';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {MongoClient} = require('mongodb');

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DATABASE || 'immo-db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runMigration(): Promise<void> {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log('\n🚀 Migration France B2B → Sénégal B2C\n');
    console.log(`📦 Base: ${DB_NAME}\n`);

    // ─── 0. Vérification : migration déjà effectuée ? ─────────────────────
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    const utilisateursCollection = db.collection('utilisateurs');
    const utilisateursCount = await utilisateursCollection.countDocuments();

    if (usersCount > 0 && utilisateursCount === 0) {
      console.log('⚠️  Collection users déjà peuplée, utilisateurs vide. Migration probablement déjà effectuée.');
      console.log('    Arrêt pour éviter les doublons.');
      return;
    }

    // ─── 1. Migration : utilisateurs → users ──────────────────────────────
    console.log('1️⃣  Migration utilisateurs → users...');
    const utilisateurs = await utilisateursCollection.find({}).toArray();
    console.log(`   Trouvé ${utilisateurs.length} utilisateur(s)`);

    if (utilisateurs.length > 0) {
      const newUsers = utilisateurs.map((u: any) => ({
        _id: u._id,
        prenom: u.prenom || u.nom?.split(' ')[0] || 'Prénom',
        nom: u.nom || 'Nom',
        email: (u.email || '').toLowerCase().trim(),
        mot_de_passe: u.motDePasse || u.mot_de_passe || '',
        // Téléphone : tenter de normaliser, sinon valeur brute
        telephone: normaliserTelephone(u.phoneNumber || u.telephone || ''),
        role: mapRole(u.role),
        avatar_url: u.avatar_url,
        bio: u.bio,
        ville: 'Dakar', // Valeur par défaut : tous migrés sur Dakar
        email_verifie: u.verified ?? u.email_verifie ?? false,
        token_email: u.verificationToken,
        reset_password_token: u.resetPasswordToken,
        reset_password_expiry: u.resetPasswordTokenExpiry ? new Date(u.resetPasswordTokenExpiry) : undefined,
        actif: true,
        otp: u.otp,
        otp_expiry: u.otpExpiry,
        // Sous-documents initialisés avec valeurs par défaut
        abonnement: {plan: 'gratuit', actif: false, prix_fcfa: 0},
        badges: {verifie: false, top_courtier: false, ultra_reactif: false, photos_certifiees: false, premium: false},
        verification: {statut: 'en_attente'},
        stats: {nb_annonces_actives: 0, nb_annonces_total: 0, nb_transactions: 0, nb_vues_total: 0, nb_contacts_recus: 0, note_moyenne: 0, nb_avis: 0, taux_reponse: 0},
        limites: {max_annonces: 5, max_photos_par_annonce: 10, visites_360_restantes: 0, videos_restantes: 0, boosts_gratuits_restants: 0},
        createdAt: u.createdAt || new Date(),
        updatedAt: new Date(),
      }));

      // Insérer dans la collection users (upsert par _id)
      for (const user of newUsers) {
        await usersCollection.updateOne(
          {_id: user._id},
          {$setOnInsert: user},
          {upsert: true},
        );
      }

      // Renommer l'ancienne collection
      await renameIfExists(db, 'utilisateurs', 'utilisateurs_legacy');
      console.log(`   ✅ ${newUsers.length} utilisateur(s) migrés → collection 'users'`);
      console.log(`   ✅ 'utilisateurs' renommée en 'utilisateurs_legacy'`);
    }

    // ─── 2. Migration : bienimmos → biens ─────────────────────────────────
    console.log('\n2️⃣  Migration bienimmos → biens...');
    const bienimmosCollection = db.collection('bienimmos');
    const bienimmos = await bienimmosCollection.find({}).toArray();
    console.log(`   Trouvé ${bienimmos.length} bien(s)`);

    if (bienimmos.length > 0) {
      const biensCollection = db.collection('biens');
      const newBiens = bienimmos.map((b: any) => {
        // Déterminer le type de transaction depuis le statut ou les données
        const typeTransaction = b.typeTransaction || 'vente';

        // Mapper le type de bien
        const typeBien = mapTypeBien(b.typeBien || b.type_bien || 'appartement');

        // Construire la localisation Sénégal
        const localisation = {
          ville: 'Dakar', // Migration par défaut, à corriger manuellement
          quartier: b.localisation?.rue || b.localisation?.quartier || 'Non précisé',
          adresse: [b.localisation?.numero, b.localisation?.rue, b.localisation?.codePostal, b.localisation?.ville]
            .filter(Boolean).join(', '),
        };

        // Construire les finances (EUR → FCFA : taux moyen ~655 XOF/EUR)
        const finances: any = {};
        if (b.prix?.hai) {
          finances.prix_vente_fcfa = Math.round(b.prix.hai * 655);
          finances.prix_negociable = false;
        }
        finances.commission_pct = b.prix?.honorairePourcentage || 5;

        // Caractéristiques
        const caracteristiques: any = {
          surface_m2: b.surfaces?.habitable,
          nb_chambres: b.pieces?.filter((p: any) => p.type === 'chambre').length || 0,
          nb_salles_de_bain: b.pieces?.filter((p: any) => p.type === 'salleDeBain').length || 0,
          ascenseur: b.caracteristiques?.ascenseur || false,
          piscine: b.caracteristiques?.piscine || false,
          jardin: b.caracteristiques?.jardin || false,
          terrasse: b.caracteristiques?.terrasse || false,
          parking: b.caracteristiques?.parkingOuvert || false,
        };

        const titre = b.description?.titre || `Bien immobilier - ${typeBien}`;
        const description = b.description?.annonce;

        return {
          _id: b._id,
          reference: null, // Sera généré à la première sauvegarde
          courtier_id: b.utilisateurId,
          type_transaction: typeTransaction,
          type_bien: typeBien,
          titre: titre.substring(0, 100),
          description,
          localisation,
          caracteristiques,
          finances,
          medias: (b.listeImages || []).map((url: string, idx: number) => ({
            url,
            type: 'photo',
            ordre: idx,
            est_principale: idx === 0,
          })),
          boost: {actif: false},
          stats: {nb_vues: 0, nb_contacts: 0, nb_favoris: 0, nb_partages_whatsapp: 0},
          statut: mapStatutBien(b.statut),
          moderation: {statut: 'non_verifie', nb_signalements: 0},
          en_vedette: false,
          date_publication: b.datePublication ? new Date(b.datePublication) : undefined,
          createdAt: b.createdAt || new Date(),
          updatedAt: new Date(),
        };
      });

      for (const bien of newBiens) {
        await biensCollection.updateOne(
          {_id: bien._id},
          {$setOnInsert: bien},
          {upsert: true},
        );
      }

      await renameIfExists(db, 'bienimmos', 'bienimmos_legacy');
      console.log(`   ✅ ${newBiens.length} bien(s) migrés → collection 'biens'`);
      console.log(`   ✅ 'bienimmos' renommée en 'bienimmos_legacy'`);
    }

    // ─── 3. Migration : paniers → favoris ─────────────────────────────────
    console.log('\n3️⃣  Migration paniers (B2B) → favoris (B2C)...');
    const paniers = await db.collection('paniers').find({}).toArray();
    const bienPaniers = await db.collection('bienpaniers').find({}).toArray();
    console.log(`   Trouvé ${paniers.length} panier(s), ${bienPaniers.length} lien(s) bien-panier`);

    if (bienPaniers.length > 0) {
      const favorisCollection = db.collection('favoris');

      // Construire un map panierId → utilisateurId
      const panierToUser: Record<string, any> = {};
      for (const panier of paniers) {
        panierToUser[panier._id.toString()] = panier.utilisateurId;
      }

      const nouveauxFavoris = bienPaniers
        .filter((bp: any) => bp.panierId && bp.bienImmoId)
        .map((bp: any) => ({
          acheteur_id: panierToUser[bp.panierId?.toString()] ?? null,
          bien_id: bp.bienImmoId,
          note_personnelle: null,
          createdAt: bp.createdAt || new Date(),
          updatedAt: new Date(),
        }))
        .filter((f: any) => f.acheteur_id !== null);

      if (nouveauxFavoris.length > 0) {
        await favorisCollection.insertMany(nouveauxFavoris, {ordered: false});
        console.log(`   ✅ ${nouveauxFavoris.length} favori(s) créé(s) depuis les paniers`);
      }

      await renameIfExists(db, 'paniers', 'paniers_legacy');
      await renameIfExists(db, 'bienpaniers', 'bienpaniers_legacy');
    }

    // ─── 4. Migration : messages (nouveau schéma) ──────────────────────────
    console.log('\n4️⃣  Migration messages (ancien schéma → nouveau)...');
    const oldMessages = await db.collection('messages').find({
      conversation_id: {$exists: false},   // Pas encore migrés
      conversationId: {$exists: true},     // Ancienne structure
    }).toArray();
    console.log(`   Trouvé ${oldMessages.length} message(s) à migrer`);

    if (oldMessages.length > 0) {
      const messagesCollection = db.collection('messages');
      for (const msg of oldMessages) {
        // Générer conversation_id depuis l'ancienne structure
        const conversationId = msg.conversationId?.toString() || `migrated_${msg._id}`;
        await messagesCollection.updateOne(
          {_id: msg._id},
          {
            $set: {
              conversation_id: conversationId,
              expediteur_id: msg.senderId,
              destinataire_id: msg.destinataire_id || null,
              contenu: msg.content || msg.contenu || '',
              lu: msg.isRead ?? false,
              date_lecture: msg.readAt ? new Date(msg.readAt) : undefined,
              type: 'texte',
            },
            $unset: {conversationId: '', senderId: '', content: '', isRead: '', readAt: ''},
          },
        );
      }
      console.log(`   ✅ ${oldMessages.length} message(s) migré(s) vers nouveau schéma`);
    }

    // ─── 5. Création des index MongoDB ────────────────────────────────────
    console.log('\n5️⃣  Création des index...');
    await createIndexes(db);
    console.log('   ✅ Index créés');

    // ─── Résumé ───────────────────────────────────────────────────────────
    console.log('\n✅ Migration terminée avec succès !');
    console.log('\n📋 Actions post-migration recommandées :');
    console.log('   1. Vérifier manuellement les villes (tout est mis à "Dakar" par défaut)');
    console.log('   2. Vérifier les numéros de téléphone migrés (format +221XXXXXXXXX)');
    console.log('   3. Vérifier la conversion EUR→FCFA des prix (taux 655 utilisé)');
    console.log('   4. Valider les collections _legacy avant de les supprimer');
    console.log('   5. Redémarrer le serveur LoopBack\n');

  } catch (error) {
    console.error('\n❌ Erreur de migration:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renameIfExists(db: any, from: string, to: string): Promise<void> {
  try {
    const collections = await db.listCollections({name: from}).toArray();
    if (collections.length > 0) {
      await db.collection(from).rename(to, {dropTarget: false});
    }
  } catch (e: any) {
    if (!e.message?.includes('already exists')) {
      console.warn(`   ⚠️  Impossible de renommer ${from} → ${to}:`, e.message);
    }
  }
}

function normaliserTelephone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-().]/g, '');
  // Déjà au format E.164 Sénégal
  if (/^\+221[37][0-9]{8}$/.test(cleaned)) return cleaned;
  // Préfixe local (7X ou 3X) → ajouter +221
  if (/^[37][0-9]{8}$/.test(cleaned)) return `+221${cleaned}`;
  // Numéro français ou autre → conserver tel quel avec avertissement
  return cleaned || '';
}

function mapRole(role: string): string {
  const roleMap: Record<string, string> = {
    'admin': 'admin',
    'agent': 'courtier',
    'courtier': 'courtier',
    'acheteur': 'acheteur',
    'buyer': 'acheteur',
    'vendeur': 'courtier',
    'user': 'acheteur',
  };
  return roleMap[role?.toLowerCase()] || 'acheteur';
}

function mapTypeBien(type: string): string {
  const typeMap: Record<string, string> = {
    'maison': 'villa',
    'appartement': 'appartement',
    'villa': 'villa',
    'studio': 'studio',
    'duplex': 'duplex',
    'bureau': 'bureau',
    'commerce': 'commerce',
    'terrain': 'terrain',
    'entrepot': 'entrepot',
    'chambre': 'chambre',
    'local': 'commerce',
  };
  return typeMap[type?.toLowerCase()] || 'appartement';
}

function mapStatutBien(statut: string): string {
  const statutMap: Record<string, string> = {
    'actif': 'publie',
    'vendu': 'vendu',
    'archive': 'archive',
    'brouillon': 'brouillon',
    'publie': 'publie',
  };
  return statutMap[statut?.toLowerCase()] || 'brouillon';
}

async function createIndexes(db: any): Promise<void> {
  // Users
  await db.collection('users').createIndex({email: 1}, {unique: true});
  await db.collection('users').createIndex({telephone: 1});
  await db.collection('users').createIndex({role: 1, ville: 1});
  await db.collection('users').createIndex({'badges.verifie': 1});
  await db.collection('users').createIndex({'stats.note_moyenne': -1});

  // Biens
  await db.collection('biens').createIndex({'localisation.coordonnees': '2dsphere'}, {sparse: true});
  await db.collection('biens').createIndex({statut: 1, type_transaction: 1, type_bien: 1});
  await db.collection('biens').createIndex({'localisation.ville': 1, 'localisation.quartier': 1});
  await db.collection('biens').createIndex({'finances.loyer_mensuel_fcfa': 1});
  await db.collection('biens').createIndex({'finances.prix_vente_fcfa': 1});
  await db.collection('biens').createIndex({en_vedette: -1, 'stats.nb_vues': -1});
  await db.collection('biens').createIndex({courtier_id: 1, statut: 1});
  await db.collection('biens').createIndex({createdAt: -1});

  // Demandes contact
  await db.collection('demandes_contact').createIndex({courtier_id: 1, statut: 1});
  await db.collection('demandes_contact').createIndex({acheteur_id: 1});
  await db.collection('demandes_contact').createIndex({bien_id: 1});
  await db.collection('demandes_contact').createIndex({code_visite: 1}, {sparse: true});

  // Avis
  await db.collection('avis').createIndex({courtier_id: 1, statut: 1});
  await db.collection('avis').createIndex({demande_id: 1}, {unique: true});

  // Transactions
  await db.collection('transactions').createIndex({user_id: 1, statut: 1});
  await db.collection('transactions').createIndex({reference_externe: 1}, {sparse: true});

  // Favoris
  await db.collection('favoris').createIndex({acheteur_id: 1, bien_id: 1}, {unique: true});

  // Messages
  await db.collection('messages').createIndex({conversation_id: 1, createdAt: -1});
  await db.collection('messages').createIndex({destinataire_id: 1, lu: 1});
}

// ─── Exécution ────────────────────────────────────────────────────────────────
runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
