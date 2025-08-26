import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {Media} from './media.model';
import {Utilisateur} from './utilisateur.model';

@model({settings: {strict: true}}) // Enable strict mode for better type safety
export class BienImmo extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  // Localisation
  @property({
    type: 'string',
    required: true,
  })
  numeroRue: string; // N° (e.g., "123")

  @property({
    type: 'string',
    required: true,
  })
  rue: string; // Rue (e.g., "Avenue des Champs-Élysées")

  @property({
    type: 'string',
    required: true,
  })
  codePostal: string; // Code postal (e.g., "75008")

  @property({
    type: 'string',
    required: true,
  })
  ville: string; // Ville (e.g., "Paris")

  @property({
    type: 'string',
    required: true,
  })
  departement: string; // Département (e.g., "Île-de-France")

  // Structure
  @property({
    type: 'string',
    required: true,
  })
  typeBien: string; // Type (e.g., "Villa", "Appartement", "Colocation")

  @property({
    type: 'number',
    required: true,
  })
  nombrePieces: number; // Nombre de pièces (e.g., 5 for 5 rooms)

  // Pièces
  @property({
    type: 'number',
    required: false,
  })
  cuisine?: number; // Cuisine (e.g., 1)

  @property({
    type: 'number',
    required: false,
  })
  salleDeBain?: number; // Salle de bain (e.g., 2)

  @property({
    type: 'number',
    required: false,
  })
  salleDEau?: number; // Salle d'eau (e.g., 1)

  @property({
    type: 'number',
    required: false,
  })
  sejour?: number; // Séjour (living room, e.g., 1)

  @property({
    type: 'number',
    required: false,
  })
  chambres?: number; // Chambres (bedrooms, e.g., 4)

  @property({
    type: 'array',
    itemType: 'string',
    required: false,
  })
  autresPieces?: string[]; // Autres (e.g., ["Bureau", "Salle de jeux"])

  @property({
    type: 'number',
    required: false,
  })
  nombreNiveaux?: number; // Nombre de niveaux (e.g., 2 for two floors)

  // Caractéristiques
  @property({
    type: 'boolean',
    required: false,
  })
  grenier?: boolean; // Grenier (attic)

  @property({
    type: 'boolean',
    required: false,
  })
  balcon?: boolean; // Balcon

  @property({
    type: 'boolean',
    required: false,
  })
  cave?: boolean; // Cave (basement)

  @property({
    type: 'boolean',
    required: false,
  })
  parkingOuvert?: boolean; // Parking ouvert

  @property({
    type: 'boolean',
    required: false,
  })
  jardin?: boolean; // Jardin

  @property({
    type: 'boolean',
    required: false,
  })
  dependance?: boolean; // Dépendance (outbuilding)

  @property({
    type: 'boolean',
    required: false,
  })
  box?: boolean; // Box (garage/storage)

  @property({
    type: 'boolean',
    required: false,
  })
  ascenseur?: boolean; // Ascenseur (elevator)

  @property({
    type: 'boolean',
    required: false,
  })
  piscine?: boolean; // Piscine

  @property({
    type: 'boolean',
    required: false,
  })
  accesEgout?: boolean; // Accès égout (sewer access)

  @property({
    type: 'boolean',
    required: false,
  })
  terrasse?: boolean; // Terrasse

  // Surfaces
  @property({
    type: 'number',
    required: true,
  })
  surfaceHabitable: number; // Habitable (e.g., 200 m²)

  @property({
    type: 'number',
    required: false,
  })
  surfaceTerrain?: number; // Terrain (e.g., 500 m²)

  @property({
    type: 'number',
    required: false,
  })
  surfaceLoiCarrez?: number; // Habitable (loi Carrez, e.g., 195 m²)

  @property({
    type: 'number',
    required: false,
  })
  surfaceSejour?: number; // Séjour (e.g., 40 m²)

  @property({
    type: 'number',
    required: false,
  })
  surfaceChambre1?: number; // Chambre 1 (e.g., 20 m²)

  @property({
    type: 'number',
    required: false,
  })
  surfaceChambre2?: number; // Chambre 2

  @property({
    type: 'number',
    required: false,
  })
  surfaceChambre3?: number; // Chambre 3

  @property({
    type: 'number',
    required: false,
  })
  surfaceSalleDeBain?: number; // Salle de bain

  @property({
    type: 'number',
    required: false,
  })
  surfaceDegagement?: number; // Dégagement (hallway)

  @property({
    type: 'number',
    required: false,
  })
  surfaceWc1?: number; // WC 1

  @property({
    type: 'number',
    required: false,
  })
  surfaceWc2?: number; // WC 2

  @property({
    type: 'number',
    required: false,
  })
  surfaceLingerie?: number; // Lingerie (laundry room)

  @property({
    type: 'number',
    required: false,
  })
  surfaceGarage?: number; // Garage

  // Orientation
  @property({
    type: 'string',
    required: false,
  })
  orientationJardin?: string; // Jardin (e.g., "Sud")

  @property({
    type: 'string',
    required: false,
  })
  orientationTerrasse?: string; // Terrasse (e.g., "Ouest")

  // Chauffage / Clim
  @property({
    type: 'boolean',
    required: false,
  })
  cheminee?: boolean; // Cheminée (fireplace)

  @property({
    type: 'boolean',
    required: false,
  })
  poeleABois?: boolean; // Poêle à bois (wood stove)

  @property({
    type: 'boolean',
    required: false,
  })
  insertABois?: boolean; // Insert à bois (wood insert)

  @property({
    type: 'boolean',
    required: false,
  })
  poeleAPellets?: boolean; // Poêle à pellets

  @property({
    type: 'boolean',
    required: false,
  })
  chauffageIndividuelChaudiere?: boolean; // Chauffage individuel chaudière (individual boiler)

  @property({
    type: 'boolean',
    required: false,
  })
  chauffageAuSol?: boolean; // Chauffage au sol (underfloor heating)

  @property({
    type: 'boolean',
    required: false,
  })
  chauffageIndividuelElectrique?: boolean; // Chauffage individuel électrique

  @property({
    type: 'boolean',
    required: false,
  })
  chauffageUrbain?: boolean; // Chauffage urbain (district heating)

  // Energie
  @property({
    type: 'boolean',
    required: false,
  })
  electricite?: boolean; // Électricité

  @property({
    type: 'boolean',
    required: false,
  })
  gaz?: boolean; // Gaz

  @property({
    type: 'boolean',
    required: false,
  })
  fioul?: boolean; // Fioul (oil)

  @property({
    type: 'boolean',
    required: false,
  })
  pompeAChaleur?: boolean; // Pompe à chaleur (heat pump)

  @property({
    type: 'boolean',
    required: false,
  })
  geothermie?: boolean; // Géothermie (geothermal)

  // Bâtiment
  @property({
    type: 'number',
    required: false,
  })
  anneeConstruction?: number; // Année de construction (e.g., 2010)

  @property({
    type: 'boolean',
    required: false,
  })
  copropriete?: boolean; // Copropriété (condominium)

  // Energie (Diagnostics)
  @property({
    type: 'string',
    required: false,
  })
  dpe?: string; // DPE (lettre, e.g., "C")

  @property({
    type: 'string',
    required: false,
  })
  ges?: string; // GES (lettre, e.g., "B")

  @property({
    type: 'date',
    required: false,
  })
  dateDiagnostique?: string; // Date diagnostique (e.g., "2025-08-24")

  // Prix
  @property({
    type: 'number',
    required: true,
  })
  prixHAI: number; // Prix HAI (honoraires inclus, e.g., 2500000)

  @property({
    type: 'number',
    required: false,
  })
  honorairePourcentage?: number; // Honoraires % (e.g., 5)

  @property({
    type: 'number',
    required: false,
  })
  honoraireEuros?: number; // Honoraires € (e.g., 125000)

  @property({
    type: 'string',
    required: false,
  })
  chargesAcheteurVendeur?: string; // Charges acheteur/vendeur (e.g., "Acheteur")

  @property({
    type: 'number',
    required: false,
  })
  netVendeur?: number; // Net vendeur (e.g., 2375000)

  @property({
    type: 'number',
    required: false,
  })
  chargesAnnuellesCopropriete?: number; // Charges annuelles copropriété (e.g., 3000)

  // Description
  @property({
    type: 'string',
    required: true,
  })
  titre: string; // Titre (e.g., "Villa de luxe à Nice")

  @property({
    type: 'string',
    required: true,
  })
  description: string; // Annonce description

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  listeImages: string[]; // Liste des images

  @property({
    type: 'date',
    required: true,
  })
  datePublication: string; // Date de publication

  @property({
    type: 'string',
    required: true,
  })
  statut: string; // Statut (e.g., "Actif", "Vendu")

  // Relations
  @belongsTo(() => Utilisateur)
  utilisateurId: string;

  @hasMany(() => Media)
  media: Media[];

  constructor(data?: Partial<BienImmo>) {
    super(data);
  }
}

export interface BienImmoRelations {
  utilisateur?: Utilisateur;
  media?: Media[];
}

export type BienImmoWithRelations = BienImmo & BienImmoRelations;
