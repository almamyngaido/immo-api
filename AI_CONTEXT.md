# IMMO-API - AI Context Document

## What is this?

A **real estate listing platform API** built with **LoopBack 4 (TypeScript)** on **MongoDB**. It allows users to list properties for sale, browse listings, save favorites to a cart, and message sellers directly.

## Tech Stack

- **Framework**: LoopBack 4 (Node.js)
- **Language**: TypeScript
- **Database**: MongoDB
- **Auth**: JWT + OTP (via Brevo email)
- **File uploads**: Multer (images)
- **Deployment**: Railway

## Models & Relations

```
Utilisateur (User)
├── id, nom, prenom, email, motDePasse, role, phoneNumber
├── verified, verificationToken, otp, otpExpiry
├── resetPasswordToken, resetPasswordTokenExpiry, dateInscription
│
├── hasMany → BienImmo (user lists properties)
├── hasOne  → Panier (user has one cart)
├── hasMany → Role (through UtilisateurRole)
├── hasMany → Message (as sender)
└── hasMany → Conversation (as participant)

BienImmo (Property Listing)
├── typeBien, nombrePiecesTotal, nombreNiveaux, statut, datePublication
├── localisation: { numero, rue, codePostal, ville, departement }
├── surfaces: { habitable, terrain, habitableCarrez, garage }
├── prix: { hai, honorairePourcentage, netVendeur, chargesAnnuellesCopropriete }
├── description: { titre, annonce }
├── caracteristiques: { balcon, cave, parking, jardin, piscine, ascenseur, ... }
├── chauffageClim, energie, batiment, diagnosticsEnergie (nested objects)
├── pieces[]: { type, surface, orientation, niveau, ... } (room details)
├── listeImages[]
│
├── belongsTo → Utilisateur (seller)
├── hasMany   → Media (images)
└── hasMany   → Conversation

Panier (Shopping Cart)
├── id, utilisateurId
├── belongsTo → Utilisateur
└── hasMany   → BienImmo (through BienPanier)

BienPanier (Cart Item - junction table)
├── id, statutDemande ("pending"|"accepted"|"rejected")
├── panierId, bienImmoId
└── belongsTo → BienImmo

Conversation
├── id, bienImmoId, participantIds[], createdAt, lastMessageAt
├── unreadCountBuyer, unreadCountSeller, lastMessagePreview
├── belongsTo → BienImmo
└── hasMany   → Message

Message
├── id, conversationId, senderId, content, timestamp
├── isRead, readAt, attachmentUrl, attachmentType
├── belongsTo → Conversation
└── belongsTo → Utilisateur (sender)

Media (Property Images)
├── id, nom, url, bienImmoId
└── belongsTo → BienImmo

Role
├── id, description

UtilisateurRole (junction)
├── utilisateurId, roleId
```

## API Endpoints Summary

### Auth (`/`)
| Method | Route | Description |
|--------|-------|-------------|
| POST | /signup | Register (sends OTP for verification) |
| POST | /login | Login (email+password or phone+OTP) |
| POST | /verify-email-otp | Verify email with OTP |
| POST | /forgot-password | Request password reset |
| POST | /reset-password | Reset password with token |
| POST | /change-password | Change password (auth required) |
| POST | /send-user-otp | Admin: send OTP to a user |
| GET | /me | Get current user profile (auth required) |

### Properties (`/bien-immos`)
Full CRUD: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`
- `GET /bien-immos` - List with filters (includes seller relation)
- `POST /bien-immos/{id}/media` - Upload images (multipart, max 10MB, JPEG/PNG/GIF/WebP)
- `GET /bien-immos/{id}/utilisateur` - Get property seller

### Cart (`/paniers`)
Full CRUD + custom:
- `POST /paniers/ajouter-bien` - Add property to cart
- `GET /paniers/{id}/bien-immos` - List cart items

### Messaging (`/conversations`, `/messages`)
- `POST /conversations` - Start conversation (with optional initial message)
- `GET /conversations/user/{userId}` - User's conversations
- `GET /conversations/user/{userId}/unread-count` - Unread count
- `GET /conversations/{id}/messages` - Get messages
- `PATCH /conversations/{id}/mark-read` - Mark as read
- `POST /messages` - Send message

### Users (`/utilisateurs`)
Full CRUD + role management + verification status updates.

## Auth Flow

1. **Signup** → User created (unverified) → Admin notified by email
2. **Admin sends OTP** via `/send-user-otp`
3. **User verifies** via `/verify-email-otp` → `verified: true`
4. **Login** → Returns JWT token (24h expiry)
5. JWT contains: `{id, name, email, phoneNumber, roles[]}`

## Key Business Rules

- Passwords: min 8 chars, must have lowercase + uppercase + digit, bcrypt hashed
- Phone numbers: validated and normalized to E.164 (default country: FR)
- Disposable emails are rejected
- Email + phoneNumber must be unique
- Property images stored in `./uploads/bien-immos/`
- Conversations are per-property between buyer and seller
- Unread counts tracked per participant side

## Project Structure

```
src/
├── controllers/     # 20 REST controllers
├── models/          # 9 entity models
├── repositories/    # 10 data repositories
├── services/        # JWT, Email (Brevo), Password hashing
├── datasources/     # MongoDB connection
├── application.ts   # App config (CORS, bindings, static files)
├── sequence.ts      # Request middleware
└── index.ts         # Entry point
```

## Environment Variables

```
PORT, HOST, NODE_ENV
MONGODB_URL, MONGODB_DATABASE
JWT_SECRET, JWT_EXPIRY
BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
FRONTEND_URL
```
