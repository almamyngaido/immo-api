# Quick Backend Upload Test

Let's verify the upload endpoint is working on the backend.

## Step 1: Get a Property ID

In MongoDB shell or Compass:
```javascript
db.BienImmo.findOne({}, {_id: 1})
// Copy the ID, e.g., "6947e3286be1c82e3c6ac202"
```

Or use one from your console: `6947e3286be1c82e3c6ac202`

## Step 2: Test Upload with PowerShell

```powershell
# Replace with a real image path on your computer
$imagePath = "C:\Users\almam\Pictures\test-house.jpg"
$propertyId = "6947e3286be1c82e3c6ac202"

# Test upload
curl.exe -X POST "http://192.168.1.4:3000/bien-immos/$propertyId/media" -F "file=@$imagePath"
```

### Expected Response:

```json
{
  "success": true,
  "message": "1 file(s) uploaded successfully",
  "files": [
    {
      "filename": "1734786123456-123456789.jpg",
      "url": "uploads/bien-immos/1734786123456-123456789.jpg",
      "path": "uploads/bien-immos/1734786123456-123456789.jpg"
    }
  ],
  "bienImmo": {
    "id": "6947e3286be1c82e3c6ac202",
    "listeImages": [
      "uploads/bien-immos/1734786123456-123456789.jpg"
    ],
    ...
  }
}
```

### Backend Console Should Show:

```
📸 Processing 1 file(s) for BienImmo 6947e3286be1c82e3c6ac202
✅ Uploaded: 1734786123456-123456789.jpg
💾 Updated BienImmo 6947e3286be1c82e3c6ac202 with 1 images
```

## Step 3: Verify Image Accessible

Open browser to:
```
http://192.168.1.4:3000/uploads/bien-immos/1734786123456-123456789.jpg
```

Should display the uploaded image.

## Step 4: Check Database

```javascript
db.BienImmo.findOne({_id: ObjectId("6947e3286be1c82e3c6ac202")}, {listeImages: 1})

// Should show:
// {
//   "_id": ObjectId("6947e3286be1c82e3c6ac202"),
//   "listeImages": ["uploads/bien-immos/1734786123456-123456789.jpg"]
// }
```

---

## If Upload Works ✅

Backend is fine! Now test from Flutter app:

1. **Hot Restart Flutter**: `r` in terminal (or restart app completely)
2. **Create a NEW property** with images
3. **Watch console** for detailed debug output
4. Should see:
   ```
   🏠 STARTING PROPERTY SUBMISSION
   ✅ Validation passed
   📸 Found 3 images to upload
   🚀 Creating BienImmo...
   📸 Uploading image 1/3...
   ✅ Image uploaded: uploads/...
   ```

---

## If Upload Fails ❌

### Error: "404 Not Found"

Backend controller not loaded. Check:
```bash
cd C:\Users\almam\immo\immo-api
npm run build
npm start
```

Look for: `✅ Created uploads directory: ...`

### Error: "Cannot find module 'multer'"

```bash
npm install multer @types/multer
npm run build
npm start
```

### Error: "No such file or directory"

Create uploads folder:
```bash
mkdir uploads
mkdir uploads\bien-immos
```

---

## Quick Commands

```bash
# Test if endpoint exists
curl.exe http://192.168.1.4:3000/explorer

# List uploaded files
dir C:\Users\almam\immo\immo-api\uploads\bien-immos

# Check MongoDB
mongosh
use your-database-name
db.BienImmo.find({}, {listeImages: 1, typeBien: 1}).pretty()
```
