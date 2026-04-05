import {inject} from '@loopback/core';
import {
  post,
  Request,
  Response,
  RestBindings,
  requestBody,
} from '@loopback/rest';
import multer from 'multer';
import {v2 as cloudinary} from 'cloudinary';
import {Readable} from 'stream';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? 'delfon5lw',
  api_key:    process.env.CLOUDINARY_API_KEY    ?? '224758895562585',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? '6QgtDOmncOh0g-WbkQP47LdP_NE',
});

// Use memory storage — files go to Cloudinary, not disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 10 * 1024 * 1024}, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png',
      'image/gif', 'image/webp',
      'application/octet-stream',
    ];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (allowedMimes.includes(file.mimetype) || (ext && allowedExts.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Received: ${file.mimetype}`));
    }
  },
});

function uploadToCloudinary(buffer: Buffer, filename: string): Promise<{url: string; public_id: string}> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'diwane/biens',
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '')}`,
        resource_type: 'image',
        transformation: [{quality: 'auto', fetch_format: 'auto'}],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({url: result.secure_url, public_id: result.public_id});
      },
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

/**
 * Controller for temporary file uploads — stores images on Cloudinary
 */
export class TempUploadController {
  constructor() {}

  @post('/uploads/temp', {
    responses: {
      200: {
        description: 'Temporary image upload (Cloudinary)',
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
                      filename:   {type: 'string'},
                      url:        {type: 'string'},
                      public_id:  {type: 'string'},
                      size:       {type: 'number'},
                      mimetype:   {type: 'string'},
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
          schema: {type: 'object', properties: {file: {type: 'string', format: 'binary'}}},
        },
      },
    })
    request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<object> {
    return new Promise<object>((resolve, reject) => {
      console.log('📸 Temp upload request received (Cloudinary)');

      upload.array('file', 10)(request, response, async (err: any) => {
        if (err) {
          console.error('❌ Multer error:', err);
          return reject(err);
        }

        try {
          const files = (request as any).files as Express.Multer.File[];
          if (!files || files.length === 0) {
            return reject(new Error('No files uploaded'));
          }

          console.log(`📸 Uploading ${files.length} file(s) to Cloudinary`);

          const uploadedFiles = [];
          for (const file of files) {
            const {url, public_id} = await uploadToCloudinary(file.buffer, file.originalname);
            uploadedFiles.push({
              filename:  public_id,
              url,
              public_id,
              size:      file.size,
              mimetype:  file.mimetype,
            });
            console.log(`✅ Cloudinary upload: ${url}`);
          }

          resolve({success: true, message: `${files.length} file(s) uploaded`, files: uploadedFiles});
        } catch (error) {
          console.error('❌ Cloudinary upload error:', error);
          reject(error);
        }
      });
    });
  }
}
