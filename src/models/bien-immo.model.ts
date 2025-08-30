import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {Media} from './media.model';
import {Utilisateur} from './utilisateur.model';

// FIXED: Add @model() decorator to ALL embedded classes
@model()
class Localisation {
  @property({type: 'string', required: true})
  numero: string;

  @property({type: 'string', required: false})
  complement?: string;

  @property({type: 'string', required: false})
  boite?: string;

  @property({type: 'string', required: true})
  rue: string;

  @property({type: 'string', required: true})
  codePostal: string;

  @property({type: 'string', required: true})
  ville: string;

  @property({type: 'string', required: true})
  departement: string;
}

@model()
class PieceDetail {
  @property({type: 'string', required: true})
  type: string;

  @property({type: 'string', required: false})
  nom?: string;

  @property({type: 'number', required: false})
  numero?: number;

  @property({type: 'number', required: true})
  surface: number;

  @property({type: 'string', required: false})
  orientation?: string;

  @property({type: 'number', required: false})
  niveau?: number;

  @property({type: 'string', required: false})
  description?: string;

  @property({type: 'boolean', default: false})
  avecBalcon?: boolean;

  @property({type: 'boolean', default: false})
  avecTerrasse?: boolean;

  @property({type: 'boolean', default: false})
  avecDressing?: boolean;

  @property({type: 'boolean', default: false})
  avecSalleDeBainPrivee?: boolean;
}

@model()
class Caracteristiques {
  @property({type: 'boolean', default: false})
  grenier: boolean;

  @property({type: 'boolean', default: false})
  balcon: boolean;

  @property({type: 'boolean', default: false})
  cave: boolean;

  @property({type: 'boolean', default: false})
  parkingOuvert: boolean;

  @property({type: 'boolean', default: false})
  jardin: boolean;

  @property({type: 'boolean', default: false})
  dependance: boolean;

  @property({type: 'boolean', default: false})
  box: boolean;

  @property({type: 'boolean', default: false})
  ascenseur: boolean;

  @property({type: 'boolean', default: false})
  piscine: boolean;

  @property({type: 'boolean', default: false})
  accesEgout: boolean;

  @property({type: 'boolean', default: false})
  terrasse: boolean;
}

@model()
class SurfacesPrincipales {
  @property({type: 'number', required: true})
  habitable: number;

  @property({type: 'number', required: false})
  terrain?: number;

  @property({type: 'number', required: false})
  habitableCarrez?: number;

  @property({type: 'number', required: false})
  garage?: number;
}

@model()
class Orientation {
  @property({type: 'string', required: false})
  jardin?: string;

  @property({type: 'string', required: false})
  terrasse?: string;

  @property({type: 'string', required: false})
  principale?: string;
}

@model()
class ChauffageClim {
  @property({type: 'boolean', default: false})
  cheminee: boolean;

  @property({type: 'boolean', default: false})
  poeleABois: boolean;

  @property({type: 'boolean', default: false})
  insertABois: boolean;

  @property({type: 'boolean', default: false})
  poeleAPellets: boolean;

  @property({type: 'boolean', default: false})
  chauffageIndividuelChaudiere: boolean;

  @property({type: 'boolean', default: false})
  chauffageAuSol: boolean;

  @property({type: 'boolean', default: false})
  chauffageIndividuelElectrique: boolean;

  @property({type: 'boolean', default: false})
  chauffageUrbain: boolean;
}

@model()
class Energie {
  @property({type: 'boolean', default: false})
  electricite: boolean;

  @property({type: 'boolean', default: false})
  gaz: boolean;

  @property({type: 'boolean', default: false})
  fioul: boolean;

  @property({type: 'boolean', default: false})
  pompeAChaleur: boolean;

  @property({type: 'boolean', default: false})
  geothermie: boolean;
}

@model()
class Batiment {
  @property({type: 'number', required: false})
  anneeConstruction?: number;

  @property({type: 'boolean', required: false})
  copropriete?: boolean;
}

@model()
class DiagnosticsEnergie {
  @property({type: 'string', required: false})
  dpe?: string;

  @property({type: 'string', required: false})
  ges?: string;

  @property({type: 'date', required: false})
  dateDiagnostique?: string;
}

@model()
class Prix {
  @property({type: 'number', required: true})
  hai: number;

  @property({type: 'number', required: false})
  honorairePourcentage?: number;

  @property({type: 'number', required: false})
  honoraireEuros?: number;

  @property({type: 'string', required: false})
  chargesAcheteurVendeur?: string;

  @property({type: 'number', required: false})
  netVendeur?: number;

  @property({type: 'number', required: false})
  chargesAnnuellesCopropriete?: number;
}

@model()
class Description {
  @property({type: 'string', required: true})
  titre: string;

  @property({type: 'string', required: true})
  annonce: string;
}

// MAIN ENTITY
@model({settings: {strict: true}})
export class BienImmo extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'object',
    required: true,
  })
  localisation: Localisation;

  @property({
    type: 'string',
    required: true,
  })
  typeBien: string;

  @property({
    type: 'number',
    required: true,
  })
  nombrePiecesTotal: number;

  @property.array(PieceDetail, {required: false})
  pieces?: PieceDetail[];

  @property({
    type: 'number',
    required: false,
  })
  nombreNiveaux?: number;

  @property({
    type: 'object',
    required: false,
  })
  caracteristiques?: Caracteristiques;

  @property({
    type: 'object',
    required: true,
  })
  surfaces: SurfacesPrincipales;

  @property({
    type: 'object',
    required: false,
  })
  orientation?: Orientation;

  @property({
    type: 'object',
    required: false,
  })
  chauffageClim?: ChauffageClim;

  @property({
    type: 'object',
    required: false,
  })
  energie?: Energie;

  @property({
    type: 'object',
    required: false,
  })
  batiment?: Batiment;

  @property({
    type: 'object',
    required: false,
  })
  diagnosticsEnergie?: DiagnosticsEnergie;

  @property({
    type: 'object',
    required: true,
  })
  prix: Prix;

  @property({
    type: 'object',
    required: true,
  })
  description: Description;

  @property.array(String, {required: false})
  listeImages?: string[];

  @property({
    type: 'date',
    required: true,
  })
  datePublication: string;

  @property({
    type: 'string',
    required: true,
  })
  statut: string;

  // Relations
  @belongsTo(() => Utilisateur)
  utilisateurId: string;

  @hasMany(() => Media)
  media: Media[];

  constructor(data?: Partial<BienImmo>) {
    super(data);
  }

  // Helper methods
  getNombreChambres(): number {
    return this.pieces?.filter(p => p.type === 'chambre').length || 0;
  }

  getNombreSallesDeBain(): number {
    return this.pieces?.filter(p => p.type === 'salleDeBain').length || 0;
  }

  getNombreCuisines(): number {
    return this.pieces?.filter(p => p.type === 'cuisine').length || 0;
  }

  getSurfaceTotaleType(type: string): number {
    return this.pieces?.filter(p => p.type === type)
      .reduce((total, piece) => total + piece.surface, 0) || 0;
  }

  getPiecesByType(type: string): PieceDetail[] {
    const pieces = this.pieces?.filter(p => p.type === type) || [];
    return pieces.sort((a, b) => (a.numero || 0) - (b.numero || 0));
  }

  getDisplayName(piece: PieceDetail): string {
    if (piece.nom) {
      return piece.nom;
    }

    const typeDisplayNames: {[key: string]: string} = {
      'chambre': 'Chambre',
      'cuisine': 'Cuisine',
      'salleDeBain': 'Salle de bain',
      'salleDEau': 'Salle d\'eau',
      'wc': 'Wc',
      'sejour': 'Séjour',
      'salon': 'Salon',
      'bureau': 'Bureau',
      'dressing': 'Dressing',
      'cellier': 'Cellier',
      'lingerie': 'Lingerie',
      'entree': 'Entrée',
      'couloir': 'Couloir',
      'garage': 'Garage',
      'cave': 'Cave',
      'grenier': 'Grenier',
      'veranda': 'Véranda',
      'degagement': 'Dégagement'
    };

    const displayName = typeDisplayNames[piece.type] || piece.type;

    if (piece.numero) {
      return `${displayName} ${piece.numero}`;
    }

    return displayName;
  }

  getSurfacesForDisplay(): Array<{label: string, surface: number, type: string}> {
    const displayList: Array<{label: string, surface: number, type: string}> = [];

    displayList.push({
      label: 'Habitable',
      surface: this.surfaces.habitable,
      type: 'principale'
    });

    if (this.surfaces.terrain) {
      displayList.push({
        label: 'Terrain',
        surface: this.surfaces.terrain,
        type: 'principale'
      });
    }

    if (this.surfaces.habitableCarrez) {
      displayList.push({
        label: 'Habitable (loi Carrez)',
        surface: this.surfaces.habitableCarrez,
        type: 'principale'
      });
    }

    if (this.pieces) {
      const pieceTypes = ['sejour', 'chambre', 'salleDeBain', 'salleDEau', 'wc', 'cuisine', 'bureau', 'dressing', 'degagement', 'lingerie', 'garage'];

      pieceTypes.forEach(type => {
        const piecesOfType = this.getPiecesByType(type);
        piecesOfType.forEach(piece => {
          displayList.push({
            label: this.getDisplayName(piece),
            surface: piece.surface,
            type: 'piece'
          });
        });
      });
    }

    return displayList;
  }

  autoAssignPieceNumbers(): void {
    if (!this.pieces) return;

    const piecesByType = new Map<string, PieceDetail[]>();

    this.pieces.forEach(piece => {
      if (!piecesByType.has(piece.type)) {
        piecesByType.set(piece.type, []);
      }
      piecesByType.get(piece.type)!.push(piece);
    });

    piecesByType.forEach((pieces, type) => {
      pieces.forEach((piece, index) => {
        if (!piece.numero) {
          piece.numero = index + 1;
        }
      });
    });
  }
}

export interface BienImmoRelations {
  utilisateur?: Utilisateur;
  media?: Media[];
}

export type BienImmoWithRelations = BienImmo & BienImmoRelations;
