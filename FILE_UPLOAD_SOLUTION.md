# File Upload Solution for Loopback 4

## 🔍 Problem Identified

Your backend **does NOT handle file uploads**. The existing endpoints only accept JSON:

- `POST /bien-immos/:id/media` expects `application/json` with Media model data
- There's NO multipart/form-data handling
- Files are never saved to disk
- `listeImages` array never gets populated

## ✅ Complete Solution

### Step 1: Install Required Packages

```bash
cd C:\Users\almam\immo\immo-api
npm install multer @types/multer
```

### Step 2: Create File Upload Controller

Create: `src/controllers/file-upload.controller.ts`

```typescript
import {inject} from '@loopback/core';
import {
  repository,
} from '@loopback/repository';
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
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

export class FileUploadController {
  constructor(
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,
    @repository(MediaRepository)
    public mediaRepository: MediaRepository,
  ) {}

  /**
   * Upload image(s) to a BienImmo property
   * POST /bien-immos/:id/upload
   */
  @post('/bien-immos/{id}/upload', {
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
      // Use multer middleware
      upload.array('file', 10)(request, response, async (err: any) => {
        if (err) {
          return reject(err);
        }

        try {
          const files = (request as any).files as Express.Multer.File[];

          if (!files || files.length === 0) {
            return reject(new Error('No files uploaded'));
          }

          // Find the BienImmo
          const bienImmo = await this.bienImmoRepository.findById(id);
          if (!bienImmo) {
            // Clean up uploaded files
            files.forEach(file => fs.unlinkSync(file.path));
            return reject(new Error('BienImmo not found'));
          }

          // Initialize listeImages if it doesn't exist
          if (!bienImmo.listeImages) {
            bienImmo.listeImages = [];
          }

          // Process each uploaded file
          const uploadedFiles = [];
          for (const file of files) {
            // Build relative path
            const relativePath = `uploads/bien-immos/${file.filename}`;

            // Add to BienImmo's listeImages array
            bienImmo.listeImages.push(relativePath);

            // Optionally create Media entity for the relation
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
          }

          // Save BienImmo with updated listeImages
          await this.bienImmoRepository.update(bienImmo);

          // Return success response
          resolve({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            files: uploadedFiles,
            bienImmo: bienImmo,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Delete image from BienImmo
   * DELETE /bien-immos/:id/upload/:filename
   */
  @post('/bien-immos/{id}/upload/{filename}/delete', {
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
      // Find the BienImmo
      const bienImmo = await this.bienImmoRepository.findById(id);
      if (!bienImmo) {
        throw new Error('BienImmo not found');
      }

      // Remove from listeImages array
      const imagePath = `uploads/bien-immos/${filename}`;
      if (bienImmo.listeImages) {
        bienImmo.listeImages = bienImmo.listeImages.filter(
          img => !img.includes(filename)
        );
      }

      // Delete file from disk
      const filePath = path.join(__dirname, '../../uploads/bien-immos', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete Media entity if exists
      const mediaEntities = await this.mediaRepository.find({
        where: {
          bienImmoId: id,
          url: imagePath,
        },
      });
      for (const media of mediaEntities) {
        await this.mediaRepository.deleteById(media.id);
      }

      // Save BienImmo
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
```

### Step 3: Configure Static File Serving

Edit: `src/application.ts`

Add this to the `constructor()` method after `this.bootOptions = { ... }`:

```typescript
import path from 'path';
import express from 'express';

// ... existing code ...

export class ImmoApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // ... existing middleware configuration ...

    // ✅ ADD THIS: Serve static files from uploads directory
    this.static('/uploads', path.join(__dirname, '../uploads'));

    // ... rest of existing code ...
  }
}
```

Or if you prefer to use middleware, create: `src/middleware/static-files.middleware.ts`

```typescript
import {Context, inject, Provider} from '@loopback/core';
import {
  Middleware,
  MiddlewareContext,
  Next,
  RestMiddlewareGroups,
} from '@loopback/rest';
import express from 'express';
import path from 'path';

export class StaticFilesMiddleware implements Provider<Middleware> {
  constructor(@inject.context() private ctx: Context) {}

  value() {
    return async (middlewareCtx: MiddlewareContext, next: Next) => {
      const {request, response} = middlewareCtx;

      if (request.path.startsWith('/uploads')) {
        const staticHandler = express.static(
          path.join(__dirname, '../../uploads')
        );
        return new Promise<void>((resolve, reject) => {
          staticHandler(request, response, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      return next();
    };
  }
}
```

### Step 4: Update Flutter App Endpoint

The Flutter app currently sends to `POST /bien-immos/:id/media`, but our new endpoint is:

**Option A: Change Backend Endpoint**
Rename the endpoint in `file-upload.controller.ts` from `/bien-immos/{id}/upload` to `/bien-immos/{id}/media`

**Option B: Update Flutter App**
Change `lib/services/post_bien_service.dart` to use `/bien-immos/:id/upload` instead

I recommend **Option A** to match what Flutter expects.

### Step 5: Test the Upload

```bash
# Start the backend
cd C:\Users\almam\immo\immo-api
npm start

# Test with curl (replace YOUR_BIEN_IMMO_ID)
curl -X POST http://192.168.1.4:3000/bien-immos/YOUR_BIEN_IMMO_ID/media \
  -F "file=@C:\path\to\test-image.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
# {
#   "success": true,
#   "message": "1 file(s) uploaded successfully",
#   "files": [
#     {
#       "filename": "1733312345678-123456789.jpg",
#       "url": "uploads/bien-immos/1733312345678-123456789.jpg",
#       "path": "uploads/bien-immos/1733312345678-123456789.jpg"
#     }
#   ],
#   "bienImmo": {
#     "id": "...",
#     "listeImages": ["uploads/bien-immos/1733312345678-123456789.jpg"]
#   }
# }
```

### Step 6: Verify Database

Check MongoDB:

```javascript
// In mongosh or MongoDB Compass
db.BienImmo.findOne({_id: ObjectId("YOUR_BIEN_IMMO_ID")})

// Should show:
// {
//   _id: ObjectId("..."),
//   typeBien: "maison",
//   listeImages: ["uploads/bien-immos/1733312345678-123456789.jpg"],
//   ...
// }
```

### Step 7: Test Image Access

Open browser to:
```
http://192.168.1.4:3000/uploads/bien-immos/1733312345678-123456789.jpg
```

Should display the uploaded image.

---

## 🔧 Alternative: Simpler Endpoint (Match Existing Pattern)

If you want to keep using the existing controller structure, update `bien-immo-media.controller.ts`:

```typescript
// Add this import
import {inject} from '@loopback/core';
import {Request, Response, RestBindings} from '@loopback/rest';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ... (add storage config from above) ...

export class BienImmoMediaController {
  constructor(
    @repository(BienImmoRepository) protected bienImmoRepository: BienImmoRepository,
  ) { }

  // ✅ ADD NEW UPLOAD ENDPOINT
  @post('/bien-immos/{id}/media', {
    responses: {
      '200': {
        description: 'File upload',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async uploadFile(
    @param.path.string('id') id: string,
    @requestBody({
      description: 'Multipart file upload',
      required: true,
      content: {
        'multipart/form-data': {
          'x-parser': 'stream',
          schema: {type: 'object'},
        },
      },
    })
    request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<object> {
    // Same upload logic as FileUploadController.uploadImages()
    // ... (copy from above) ...
  }

  // Existing endpoints stay the same
  @get('/bien-immos/{id}/media')
  async find(...) { ... }
}
```

---

## 📋 Checklist

- [ ] Install multer: `npm install multer @types/multer`
- [ ] Create `file-upload.controller.ts` OR update `bien-immo-media.controller.ts`
- [ ] Configure static file serving in `application.ts`
- [ ] Create uploads directory: `mkdir -p uploads/bien-immos`
- [ ] Restart backend: `npm start`
- [ ] Test upload with curl or Postman
- [ ] Verify files saved to `uploads/bien-immos/`
- [ ] Check MongoDB has `listeImages` populated
- [ ] Test image URL in browser
- [ ] Test from Flutter app
- [ ] Verify images display in Activity tab

---

## 🎯 Why This Fixes Your Issue

**Before:**
- ❌ No file upload handling
- ❌ listeImages always empty
- ❌ Flutter uploads fail silently or error
- ❌ Images show as fallback placeholders

**After:**
- ✅ Proper multipart/form-data handling
- ✅ Files saved to disk
- ✅ listeImages populated with paths
- ✅ Static files served at /uploads
- ✅ Media entities created for relations
- ✅ Images display dynamically in app

---

## 🔍 Debugging

### Check if upload endpoint exists:

```bash
curl http://192.168.1.4:3000/explorer
# Look for POST /bien-immos/{id}/media or /bien-immos/{id}/upload
```

### Check uploads directory:

```bash
ls -la C:\Users\almam\immo\immo-api\uploads\bien-immos
```

### Check static serving:

```bash
# Put a test.jpg in uploads/bien-immos/ then:
curl -I http://192.168.1.4:3000/uploads/bien-immos/test.jpg
# Should return 200 OK
```

---

## 🚀 Next Steps

1. Implement the file upload controller (choose one approach)
2. Test with curl to verify it works
3. Run Flutter app and upload an image
4. Check console logs - should show listeImages with actual paths
5. Images should display automatically!

