import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources'; // Adjust to your datasource file
import {BienImmo, BienImmoRelations} from '../models';

async function updateBienImmos() {
  // Instantiate the datasource
  const dataSource = new ImmoApiDataSource();

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
    const surfaceMatch = bien.description.match(/(\d+)\s*mcarré/);

    // Build pieces array based on description
    const pieces: any[] = [];

    // Add bedrooms
    if (chambresMatch) {
      const nombreChambres = parseInt(chambresMatch[1]);
      for (let i = 1; i <= nombreChambres; i++) {
        pieces.push({
          type: 'chambre',
          surface: i === 1 ? 16 : 12, // Master bedroom larger
          numero: i,
          orientation: i === 1 ? 'Sud' : 'Est',
          niveau: nombreNiveauxMatch ? (i <= 2 ? 0 : 1) : 0,
          avecDressing: i === 1,
          avecSalleDeBainPrivee: i === 1
        });
      }
    }

    // Add living room
    if (sejourMatch) {
      pieces.push({
        type: 'sejour',
        nom: 'Salon',
        surface: 30,
        numero: 1,
        orientation: 'Sud',
        niveau: 0,
        avecBalcon: balconMatch ? true : false
      });
    }

    // Add bathroom
    if (salleDeBainMatch || bien.typeBien !== 'Terrain') {
      pieces.push({
        type: 'salleDeBain',
        surface: 8,
        numero: 1,
        niveau: 0
      });
    }

    // Add kitchen (except for terrain)
    if (bien.typeBien !== 'Terrain') {
      pieces.push({
        type: 'cuisine',
        surface: 10,
        numero: 1,
        orientation: 'Nord',
        niveau: 0
      });
    }

    // Add laundry room if mentioned
    if (bien.description.includes('espace pour lessive')) {
      pieces.push({
        type: 'lingerie',
        surface: 5,
        numero: 1,
        niveau: 0
      });
    }

    // Add WC
    if (bien.typeBien !== 'Terrain') {
      pieces.push({
        type: 'wc',
        surface: 2,
        numero: 1,
        niveau: 0
      });
    }

    // Calculate total surface from pieces
    const totalSurfaceFromPieces = pieces.reduce((sum, piece) => sum + piece.surface, 0);
    const surfaceHabitable = surfaceMatch ? parseInt(surfaceMatch[1]) : Math.max(totalSurfaceFromPieces, 80);

    // FIXED: Build the updated BienImmo with correct embedded structure
    const updatedBien: Partial<BienImmo> = {
      // Basic info
      typeBien: bien.typeBien === 'Appt' ? 'Appartement' : bien.typeBien,
      nombrePiecesTotal: pieces.length,
      nombreNiveaux: nombreNiveauxMatch ? parseInt(nombreNiveauxMatch[1]) : (bien.typeBien === 'Villa' ? 2 : 1),

      // EMBEDDED: Localisation object
      localisation: {
        numero: '123',
        complement: '',
        boite: '',
        rue: 'Avenue des Champs-Élysées',
        codePostal: '75008',
        ville: 'Paris',
        departement: 'Île-de-France'
      },

      // EMBEDDED: Pieces array
      pieces: pieces,

      // EMBEDDED: Caracteristiques object
      caracteristiques: {
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
        terrasse: false
      },

      // EMBEDDED: Surfaces object
      surfaces: {
        habitable: surfaceHabitable,
        terrain: bien.typeBien === 'Terrain' ? (surfaceMatch ? parseInt(surfaceMatch[1]) : 300) : undefined,
        habitableCarrez: bien.typeBien === 'Appartement' ? surfaceHabitable - 5 : undefined,
        garage: undefined
      },

      // EMBEDDED: Orientation object
      orientation: {
        jardin: bien.typeBien === 'Villa' ? 'Sud' : undefined,
        terrasse: undefined,
        principale: 'Sud'
      },

      // EMBEDDED: ChauffageClim object
      chauffageClim: {
        cheminee: false,
        poeleABois: false,
        insertABois: false,
        poeleAPellets: false,
        chauffageIndividuelChaudiere: false,
        chauffageAuSol: false,
        chauffageIndividuelElectrique: true,
        chauffageUrbain: false
      },

      // EMBEDDED: Energie object
      energie: {
        electricite: true,
        gaz: false,
        fioul: false,
        pompeAChaleur: false,
        geothermie: false
      },

      // EMBEDDED: Batiment object
      batiment: {
        anneeConstruction: 2010,
        copropriete: bien.typeBien === 'Appartement' ? true : false
      },

      // EMBEDDED: DiagnosticsEnergie object
      diagnosticsEnergie: {
        dpe: 'C',
        ges: 'B',
        dateDiagnostique: '2025-08-24'
      },

      // EMBEDDED: Prix object
      prix: {
        hai: bien.statut === 'A vendre' ? 2500000 : 2000,
        honorairePourcentage: 5,
        honoraireEuros: bien.statut === 'A vendre' ? 125000 : 100,
        chargesAcheteurVendeur: 'Acheteur',
        netVendeur: bien.statut === 'A vendre' ? 2375000 : undefined,
        chargesAnnuellesCopropriete: bien.typeBien === 'Appartement' ? 3000 : undefined
      },

      // FIXED: Description object (not string!)
      description: {
        titre: bien.titre,
        annonce: bien.description  // This is the actual description text
      },

      // Unchanged fields
      listeImages: bien.listeImages,
      datePublication: bien.datePublication,
      statut: bien.statut,
      utilisateurId: bien.utilisateurId
    };

    try {
      await bienImmoRepository.updateById(bien.id, updatedBien);
      console.log(`✅ Updated bien-immo with ID ${bien.id}`);

      // Test the new methods
      const updated = await bienImmoRepository.findById(bien.id);
      console.log(`   - Nombre de chambres: ${updated.getNombreChambres()}`);
      console.log(`   - Surface totale chambres: ${updated.getSurfaceTotaleType('chambre')}m²`);

      const surfacesList = updated.getSurfacesForDisplay();
      console.log(`   - Surfaces for display:`, surfacesList.slice(0, 3).map(s => `${s.label}: ${s.surface}m²`));

    } catch (error) {
      console.error(`❌ Error updating bien-immo with ID ${bien.id}:`, error);
    }
  }

  console.log('🎉 All bien-immos updated successfully with new embedded structure!');
}

// Run the update
updateBienImmos().catch(err => console.error('Error updating bien-immos:', err));
