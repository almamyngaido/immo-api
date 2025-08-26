import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources'; // Adjust to your datasource file
import {BienImmo, BienImmoRelations} from '../models';

async function updateBienImmos() {
  // Instantiate the datasource
  const dataSource = new ImmoApiDataSource(); // Use 'new' to create an instance

  const bienImmoRepository = new DefaultCrudRepository<
    BienImmo,
    typeof BienImmo.prototype.id,
    BienImmoRelations
  >(BienImmo, dataSource);

  const existingBienImmos = [
    {
      id: '687cc12b757e4a2f285208ed',
      typeBien: 'Villa',
      titre: 'Villa Sangalkam',
      description: '2 etages (3 chambres, sallon)',
      listeImages: ['string'],
      datePublication: '2025-07-20T10:09:07.633Z',
      statut: 'A vendre',
      utilisateurId: '687bad9007669c33f48386b3',
    },
    {
      id: '687cc170757e4a2f285208ee',
      typeBien: 'Villa',
      titre: 'Appt Ross Bethio',
      description: '2em etages, gauche, balcon et espace pour lessive, (3 chambres, sallon)',
      listeImages: ['string'],
      datePublication: '2025-07-20T10:09:07.633Z',
      statut: 'A Louer',
      utilisateurId: '687cbf78757e4a2f285208e9',
    },
    {
      id: '687cc1ac757e4a2f285208ef',
      typeBien: 'Appt',
      titre: 'Appt Keur Ma Ndoumbe',
      description: '2em etages, balcon et espace pour lessive, Salle de bain public (5 chambres, sallon)',
      listeImages: ['string'],
      datePublication: '2025-07-20T10:09:07.633Z',
      statut: 'A Louer',
      utilisateurId: '687cbf61757e4a2f285208e8',
    },
    {
      id: '687cc38d757e4a2f285208f0',
      typeBien: 'Terrain',
      titre: 'Terrain a Kounoun',
      description: 'a l\'angle, 300 mcarré, Ecole et Mosquee non loin.',
      listeImages: ['string'],
      datePublication: '2025-07-20T10:09:07.633Z',
      statut: 'A Louer',
      utilisateurId: '687cbf97757e4a2f285208ea',
    },
  ];

  for (const bien of existingBienImmos) {
    // Infer values from description
    const chambresMatch = bien.description.match(/(\d+)\s*chambres/);
    const sejourMatch = bien.description.match(/sallon/);
    const salleDeBainMatch = bien.description.match(/Salle de bain/);
    const balconMatch = bien.description.match(/balcon/);
    const nombreNiveauxMatch = bien.description.match(/(\d+)\s*etages/);

    const updatedBien: Partial<BienImmo> = {
      id: bien.id,
      titre: bien.titre,
      description: bien.description,
      typeBien: bien.typeBien === 'Appt' ? 'Appartement' : bien.typeBien,
      statut: bien.statut,
      listeImages: bien.listeImages,
      datePublication: bien.datePublication,
      utilisateurId: bien.utilisateurId,
      // Localisation (French placeholders)
      numeroRue: '123', // Replace with actual data
      rue: 'Avenue des Champs-Élysées',
      codePostal: '75008',
      ville: 'Paris',
      departement: 'Île-de-France',
      // Structure
      nombrePieces: chambresMatch ? parseInt(chambresMatch[1]) + (sejourMatch ? 1 : 0) : 0,
      // Pièces
      chambres: chambresMatch ? parseInt(chambresMatch[1]) : undefined,
      sejour: sejourMatch ? 1 : undefined,
      salleDeBain: salleDeBainMatch ? 1 : undefined,
      salleDEau: undefined,
      cuisine: bien.typeBien !== 'Terrain' ? 1 : undefined,
      autresPieces: bien.description.includes('espace pour lessive') ? ['Lingerie'] : undefined,
      nombreNiveaux: nombreNiveauxMatch ? parseInt(nombreNiveauxMatch[1]) : undefined,
      // Caractéristiques
      grenier: false,
      balcon: balconMatch ? true : false,
      cave: false,
      parkingOuvert: false,
      jardin: bien.typeBien === 'Villa' ? true : false,
      dependance: false,
      box: false,
      ascenseur: bien.typeBien === 'Appartement' ? true : false,
      piscine: false,
      accesEgout: true,
      terrasse: false,
      // Surfaces
      surfaceHabitable: bien.description.includes('300 mcarré') ? 300 : 100,
      surfaceTerrain: bien.typeBien === 'Terrain' ? 300 : undefined,
      surfaceLoiCarrez: bien.typeBien === 'Appartement' ? 95 : undefined,
      surfaceSejour: sejourMatch ? 30 : undefined,
      surfaceChambre1: chambresMatch ? 15 : undefined,
      surfaceChambre2: chambresMatch && parseInt(chambresMatch[1]) > 1 ? 15 : undefined,
      surfaceChambre3: chambresMatch && parseInt(chambresMatch[1]) > 2 ? 15 : undefined,
      surfaceSalleDeBain: salleDeBainMatch ? 10 : undefined,
      surfaceDegagement: undefined,
      surfaceWc1: undefined,
      surfaceWc2: undefined,
      surfaceLingerie: bien.description.includes('espace pour lessive') ? 5 : undefined,
      surfaceGarage: undefined,
      // Orientation
      orientationJardin: bien.typeBien === 'Villa' ? 'Sud' : undefined,
      orientationTerrasse: undefined,
      // Chauffage / Clim
      cheminee: false,
      poeleABois: false,
      insertABois: false,
      poeleAPellets: false,
      chauffageIndividuelChaudiere: false,
      chauffageAuSol: false,
      chauffageIndividuelElectrique: true,
      chauffageUrbain: false,
      // Energie
      electricite: true,
      gaz: false,
      fioul: false,
      pompeAChaleur: false,
      geothermie: false,
      // Bâtiment
      anneeConstruction: 2010,
      copropriete: bien.typeBien === 'Appartement' ? true : false,
      // Energie (Diagnostics)
      dpe: 'C',
      ges: 'B',
      dateDiagnostique: '2025-08-24',
      // Prix
      prixHAI: bien.statut === 'A vendre' ? 2500000 : 2000,
      honorairePourcentage: 5,
      honoraireEuros: bien.statut === 'A vendre' ? 125000 : 100,
      chargesAcheteurVendeur: 'Acheteur',
      netVendeur: bien.statut === 'A vendre' ? 2375000 : undefined,
      chargesAnnuellesCopropriete: bien.typeBien === 'Appartement' ? 3000 : undefined,
    };

    await bienImmoRepository.updateById(bien.id, updatedBien);
    console.log(`Updated bien-immo with ID ${bien.id}`);
  }

  console.log('All bien-immos updated successfully!');
}

updateBienImmos().catch(err => console.error('Error updating bien-immos:', err));
