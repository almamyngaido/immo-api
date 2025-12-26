import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  post,
  Request,
  Response,
  RestBindings,
  requestBody,
  param,
} from '@loopback/rest';
import {BienImmoRepository, MediaRepository} from '../repositories';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer storage
const uploadDir = path.join(__dirname, '../../uploads/bien-immos');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {recursive: true});
  console.log('✅ Created uploads directory:', uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 File upload validation:');
    console.log('   - Original name:', file.originalname);
    console.log('   - MIME type:', file.mimetype);
    console.log('   - Field name:', file.fieldname);

    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/octet-stream', // Flutter Web sometimes sends this
    ];

    // Also check file extension as fallback
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];

    const validMime = allowedMimes.includes(file.mimetype);
    const validExt = fileExt && allowedExtensions.includes(fileExt);

    if (validMime || validExt) {
      console.log('✅ File validation passed');
      cb(null, true);
    } else {
      console.log('❌ File validation failed');
      console.log('   - MIME not in allowed list:', !validMime);
      console.log('   - Extension not allowed:', !validExt);
      cb(new Error(`Invalid file type. Received: ${file.mimetype}, Extension: ${fileExt}`));
    }
  },
});

export class FileUploadController {
  constructor(
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,
    @repository(MediaRepository)
    public mediaRepository: MediaRepository,
  ) {}

  @post('/bien-immos/{id}/media', {
    responses: {
      200: {
        description: 'BienImmo image upload',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      filename: {type: 'string'},
                      url: {type: 'string'},
                      path: {type: 'string'},
                    },
                  },
                },
                bienImmo: {type: 'object'},
              },
            },
          },
        },
      },
    },
  })
  async uploadImages(
    @param.path.string('id') id: string,
    @requestBody({
      description: 'Multipart file upload',
      required: true,
      content: {
        'multipart/form-data': {
          'x-parser': 'stream',
          schema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
      },
    })
    request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      upload.array('file', 10)(request, response, async (err: any) => {
        if (err) {
          console.error('❌ Upload error:', err);
          return reject(err);
        }

        try {
          const files = (request as any).files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return reject(new Error('No files uploaded'));
          }

          console.log(`📸 Processing ${files.length} file(s) for BienImmo ${id}`);

          const bienImmo = await this.bienImmoRepository.findById(id);
          if (!bienImmo) {
            files.forEach(file => fs.unlinkSync(file.path));
            return reject(new Error('BienImmo not found'));
          }

          if (!bienImmo.listeImages) {
            bienImmo.listeImages = [];
          }

          const uploadedFiles = [];
          for (const file of files) {
            const relativePath = `uploads/bien-immos/${file.filename}`;

            bienImmo.listeImages.push(relativePath);

            await this.mediaRepository.create({
              nom: file.originalname,
              url: relativePath,
              bienImmoId: id,
            });

            uploadedFiles.push({
              filename: file.filename,
              originalName: file.originalname,
              url: relativePath,
              path: relativePath,
              size: file.size,
              mimetype: file.mimetype,
            });

            console.log(`✅ Uploaded: ${file.filename}`);
          }

          await this.bienImmoRepository.update(bienImmo);
          console.log(`💾 Updated BienImmo ${id} with ${files.length} images`);

          resolve({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            files: uploadedFiles,
            bienImmo: bienImmo,
          });
        } catch (error) {
          console.error('❌ Error processing upload:', error);
          reject(error);
        }
      });
    });
  }

  @post('/bien-immos/{id}/media/{filename}/delete', {
    responses: {
      200: {
        description: 'Image deleted',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {type: 'boolean'},
                message: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async deleteImage(
    @param.path.string('id') id: string,
    @param.path.string('filename') filename: string,
  ): Promise<object> {
    try {
      const bienImmo = await this.bienImmoRepository.findById(id);
      if (!bienImmo) {
        throw new Error('BienImmo not found');
      }

      const imagePath = `uploads/bien-immos/${filename}`;
      if (bienImmo.listeImages) {
        bienImmo.listeImages = bienImmo.listeImages.filter(
          img => !img.includes(filename),
        );
      }

      const filePath = path.join(__dirname, '../../uploads/bien-immos', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file: ${filename}`);
      }

      const mediaEntities = await this.mediaRepository.find({
        where: {
          bienImmoId: id,
          url: imagePath,
        },
      });
      for (const media of mediaEntities) {
        await this.mediaRepository.deleteById(media.id);
      }

      await this.bienImmoRepository.update(bienImmo);

      return {
        success: true,
        message: 'Image deleted successfully',
      };
    } catch (error) {
      throw error;
    }
  }
}
