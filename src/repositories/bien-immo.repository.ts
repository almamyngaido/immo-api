import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, HasManyRepositoryFactory, repository, Where} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienImmo, BienImmoRelations, Media, Utilisateur} from '../models';
import {MediaRepository} from './media.repository';
import {UtilisateurRepository} from './utilisateur.repository';

export class BienImmoRepository extends DefaultCrudRepository<
  BienImmo,
  typeof BienImmo.prototype.id,
  BienImmoRelations
> {

  public readonly utilisateur: BelongsToAccessor<Utilisateur, typeof BienImmo.prototype.id>;
  public readonly media: HasManyRepositoryFactory<Media, typeof BienImmo.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
    @repository.getter('UtilisateurRepository') protected utilisateurRepositoryGetter: Getter<UtilisateurRepository>,
    @repository.getter('MediaRepository') protected mediaRepositoryGetter: Getter<MediaRepository>,
  ) {
    super(BienImmo, dataSource);
    this.media = this.createHasManyRepositoryFactoryFor('media', mediaRepositoryGetter);
    this.registerInclusionResolver('media', this.media.inclusionResolver);
    this.utilisateur = this.createBelongsToAccessorFor('utilisateur', utilisateurRepositoryGetter);
    this.registerInclusionResolver('utilisateur', this.utilisateur.inclusionResolver);
  }

  // ==========================================
  // NEW: Enhanced methods for embedded structure
  // ==========================================

  /**
   * Override create to auto-assign piece numbers and validate data
   */
  async create(entity: Omit<BienImmo, 'id'>, options?: any): Promise<BienImmo> {
    const bienImmo = new BienImmo(entity);

    // Auto-assign piece numbers if not set
    bienImmo.autoAssignPieceNumbers();

    // Validate data consistency
    this.validateBienImmoData(bienImmo);

    return super.create(bienImmo, options);
  }

  /**
   * Override update methods to maintain data consistency
   */
  async updateById(id: typeof BienImmo.prototype.id, data: Partial<BienImmo>, options?: any): Promise<void> {
    if (data.pieces) {
      const tempBienImmo = new BienImmo(data as any);
      tempBienImmo.autoAssignPieceNumbers();
      data.pieces = tempBienImmo.pieces;
      this.validateBienImmoData(tempBienImmo);
    }

    return super.updateById(id, data, options);
  }

  // ==========================================
  // NEW: Custom query methods for embedded data
  // ==========================================

  /**
   * Find properties with minimum number of rooms of specific type
   */
  async findWithMinRooms(roomType: string, minCount: number, where?: Where<BienImmo>): Promise<BienImmo[]> {
    const allProperties = await this.find({where});

    return allProperties.filter(property => {
      const roomCount = property.pieces?.filter(p => p.type === roomType).length || 0;
      return roomCount >= minCount;
    });
  }

  /**
   * Find properties with rooms larger than specified surface
   */
  async findWithLargeRooms(roomType: string, minSurface: number, where?: Where<BienImmo>): Promise<BienImmo[]> {
    const allProperties = await this.find({where});

    return allProperties.filter(property => {
      const hasLargeRoom = property.pieces?.some(p =>
        p.type === roomType && p.surface >= minSurface
      ) || false;
      return hasLargeRoom;
    });
  }

  /**
   * Find properties by total surface range
   */
  async findBySurfaceRange(minSurface: number, maxSurface: number, where?: Where<BienImmo>): Promise<BienImmo[]> {
    // This can be optimized with database queries if using MongoDB/SQL
    const allProperties = await this.find({where});

    return allProperties.filter(property => {
      const surface = property.surfaces.habitable;
      return surface >= minSurface && surface <= maxSurface;
    });
  }

  /**
   * Find properties with specific characteristics
   */
  async findWithCharacteristics(characteristics: string[], where?: Where<BienImmo>): Promise<BienImmo[]> {
    const allProperties = await this.find({where});

    return allProperties.filter(property => {
      if (!property.caracteristiques) return false;

      return characteristics.every(char =>
        property.caracteristiques?.[char as keyof typeof property.caracteristiques] === true
      );
    });
  }

  /**
   * Get properties grouped by type
   */
  async getPropertiesByType(): Promise<{[typeBien: string]: BienImmo[]}> {
    const allProperties = await this.find();
    const groupedProperties: {[typeBien: string]: BienImmo[]} = {};

    allProperties.forEach(property => {
      if (!groupedProperties[property.typeBien]) {
        groupedProperties[property.typeBien] = [];
      }
      groupedProperties[property.typeBien].push(property);
    });

    return groupedProperties;
  }

  /**
   * Get average surface by property type
   */
  async getAverageSurfaceByType(): Promise<{[typeBien: string]: number}> {
    const groupedProperties = await this.getPropertiesByType();
    const averages: {[typeBien: string]: number} = {};

    Object.entries(groupedProperties).forEach(([type, properties]) => {
      const totalSurface = properties.reduce((sum, prop) => sum + prop.surfaces.habitable, 0);
      averages[type] = totalSurface / properties.length;
    });

    return averages;
  }

  // ==========================================
  // VALIDATION METHODS
  // ==========================================

  /**
   * Validate data consistency for embedded objects
   */
  private validateBienImmoData(bienImmo: BienImmo): void {
    const errors: string[] = [];

    // Validate pieces
    if (bienImmo.pieces) {
      bienImmo.pieces.forEach((piece, index) => {
        if (!piece.type) {
          errors.push(`Piece ${index + 1}: type is required`);
        }
        if (!piece.surface || piece.surface <= 0) {
          errors.push(`Piece ${index + 1}: surface must be positive`);
        }
      });

      // Check total pieces count matches
      const actualPieceCount = bienImmo.pieces.length;
      if (bienImmo.nombrePiecesTotal && actualPieceCount !== bienImmo.nombrePiecesTotal) {
        console.warn(`Warning: nombrePiecesTotal (${bienImmo.nombrePiecesTotal}) doesn't match actual pieces count (${actualPieceCount})`);
      }
    }

    // Validate price data
    if (bienImmo.prix) {
      if (bienImmo.prix.hai <= 0) {
        errors.push('Prix HAI must be positive');
      }

      if (bienImmo.prix.honorairePourcentage && bienImmo.prix.honoraireEuros) {
        const calculatedHonoraire = (bienImmo.prix.hai * bienImmo.prix.honorairePourcentage) / 100;
        if (Math.abs(calculatedHonoraire - bienImmo.prix.honoraireEuros) > 100) {
          console.warn('Warning: Honoraire percentage and euro amounts may not match');
        }
      }
    }

    // Validate localisation
    if (!bienImmo.localisation?.numero || !bienImmo.localisation?.rue ||
      !bienImmo.localisation?.codePostal || !bienImmo.localisation?.ville) {
      errors.push('Complete address information is required');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}
