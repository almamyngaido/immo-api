import {inject} from '@loopback/core';
import {
  post,
  Request,
  Response,
  RestBindings,
  requestBody,
} from '@loopback/rest';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer storage for temporary uploads
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
    console.log('🔍 Temp file upload validation:');
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

/**
 * Controller for temporary file uploads (before BienImmo creation)
 */
export class TempUploadController {
  constructor() {}

  @post('/uploads/temp', {
    responses: {
      200: {
        description: 'Temporary image upload (no BienImmo ID required)',
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
                      size: {type: 'number'},
                      mimetype: {type: 'string'},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async uploadTempImages(
    @requestBody({
      description: 'Multipart file upload (temporary)',
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
      console.log('📸 Temp upload request received');

      upload.array('file', 10)(request, response, async (err: any) => {
        if (err) {
          console.error('❌ Temp upload error:', err);
          return reject(err);
        }

        try {
          const files = (request as any).files as Express.Multer.File[];

          if (!files || files.length === 0) {
            console.log('❌ No files received in request');
            return reject(new Error('No files uploaded'));
          }

          console.log(`📸 Processing ${files.length} temporary file(s)`);

          const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
          const uploadedFiles = [];
          for (const file of files) {
            const relativePath = `uploads/bien-immos/${file.filename}`;
            const fullUrl = `${appUrl}/${relativePath}`;

            uploadedFiles.push({
              filename: file.filename,
              originalName: file.originalname,
              url: fullUrl,
              path: relativePath,
              size: file.size,
              mimetype: file.mimetype,
            });

            console.log(`✅ Temp uploaded: ${file.filename} (${file.size} bytes)`);
          }

          resolve({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            files: uploadedFiles,
          });
        } catch (error) {
          console.error('❌ Error processing temp upload:', error);
          reject(error);
        }
      });
    });
  }
}
