# Messaging System API Documentation

## Overview
This document describes the messaging system API endpoints for the real estate application. The system allows buyers to message property owners about specific properties.

## Models

### Conversation
Represents a message thread between a buyer and seller about a specific property.

**Fields:**
- `id` (string): Unique identifier
- `bienImmoId` (string): Property being discussed
- `participantIds` (string[]): Array of [buyerId, sellerId]
- `createdAt` (date): When conversation was created
- `lastMessageAt` (date): When last message was sent
- `unreadCountBuyer` (number): Unread messages for buyer
- `unreadCountSeller` (number): Unread messages for seller
- `lastMessagePreview` (string): Preview of last message (first 100 chars)

### Message
Represents a single message in a conversation.

**Fields:**
- `id` (string): Unique identifier
- `conversationId` (string): Which conversation this belongs to
- `senderId` (string): User who sent the message
- `content` (string): Message text (1-5000 characters)
- `timestamp` (date): When message was sent
- `isRead` (boolean): Whether message has been read
- `readAt` (date): When message was read
- `attachmentUrl` (string, optional): URL for attachments (future use)
- `attachmentType` (string, optional): Type of attachment (future use)

---

## API Endpoints

### Conversations

#### 1. Create a Conversation
**POST** `/conversations`

Creates a new conversation or returns existing one if it already exists.

**Request Body:**
```json
{
  "bienImmoId": "property-id",
  "buyerId": "user-id",
  "initialMessage": "Hello, I'm interested in this property" // optional
}
```

**Response:** `200 OK`
```json
{
  "id": "conv-id",
  "bienImmoId": "property-id",
  "participantIds": ["buyer-id", "seller-id"],
  "createdAt": "2025-12-24T10:30:00Z",
  "lastMessageAt": "2025-12-24T10:30:00Z",
  "unreadCountBuyer": 0,
  "unreadCountSeller": 1,
  "lastMessagePreview": "Hello, I'm interested in this property"
}
```

---

#### 2. Get User's Conversations
**GET** `/conversations/user/{userId}`

Get all conversations for a specific user, ordered by last message time.

**Response:** `200 OK`
```json
[
  {
    "id": "conv-id",
    "bienImmoId": "property-id",
    "participantIds": ["buyer-id", "seller-id"],
    "lastMessageAt": "2025-12-24T10:30:00Z",
    "unreadCountBuyer": 2,
    "unreadCountSeller": 0,
    "lastMessagePreview": "When can I visit?",
    "bienImmo": {
      "id": "property-id",
      "description": {
        "titre": "Magnifique vue sur la corniche..."
      },
      "prix": {
        "hai": 760000
      },
      "listeImages": ["uploads/..."]
    }
  }
]
```

---

#### 3. Get Conversation by ID
**GET** `/conversations/{id}`

Get a specific conversation with all its details.

**Response:** `200 OK` - Conversation object with relations

---

#### 4. Get Messages in a Conversation
**GET** `/conversations/{id}/messages`

Get all messages in a conversation, ordered by timestamp (oldest first).

**Response:** `200 OK`
```json
[
  {
    "id": "msg-id",
    "conversationId": "conv-id",
    "senderId": "user-id",
    "content": "Hello, I'm interested in this property",
    "timestamp": "2025-12-24T10:30:00Z",
    "isRead": true,
    "readAt": "2025-12-24T10:35:00Z",
    "sender": {
      "id": "user-id",
      "nom": "Dupont",
      "prenom": "Jean",
      "email": "jean@example.com"
    }
  }
]
```

---

#### 5. Mark Conversation as Read
**PATCH** `/conversations/{id}/mark-read`

Mark all unread messages in a conversation as read for a specific user.

**Request Body:**
```json
{
  "userId": "user-id"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "markedCount": 3
}
```

---

#### 6. Get Unread Count for User
**GET** `/conversations/user/{userId}/unread-count`

Get total number of unread messages across all conversations for a user.

**Response:** `200 OK`
```json
{
  "totalUnread": 5
}
```

---

#### 7. Delete Conversation
**DELETE** `/conversations/{id}`

Delete a conversation and all its messages.

**Response:** `204 No Content`

---

### Messages

#### 1. Send a Message
**POST** `/messages`

Send a new message in an existing conversation.

**Request Body:**
```json
{
  "conversationId": "conv-id",
  "senderId": "user-id",
  "content": "When can I schedule a visit?"
}
```

**Response:** `200 OK`
```json
{
  "id": "msg-id",
  "conversationId": "conv-id",
  "senderId": "user-id",
  "content": "When can I schedule a visit?",
  "timestamp": "2025-12-24T11:00:00Z",
  "isRead": false
}
```

**Side Effects:**
- Updates conversation's `lastMessageAt`
- Updates conversation's `lastMessagePreview`
- Increments unread count for receiver
- (Future) Sends email/SMS notification

---

#### 2. Get All Messages
**GET** `/messages`

Get all messages (with optional filters).

**Query Parameters:** Standard LoopBack filter query

**Response:** `200 OK` - Array of Message objects

---

#### 3. Get Message by ID
**GET** `/messages/{id}`

Get a specific message.

**Response:** `200 OK` - Message object

---

#### 4. Mark Single Message as Read
**PATCH** `/messages/{id}/mark-read`

Mark a single message as read.

**Response:** `204 No Content`

---

#### 5. Delete Message
**DELETE** `/messages/{id}`

Delete a specific message.

**Response:** `204 No Content`

---

## Usage Flow

### Buyer Starts Conversation

1. Buyer views property details
2. Clicks "Contacter le propriétaire" button
3. App calls `POST /conversations` with:
   ```json
   {
     "bienImmoId": "property-id",
     "buyerId": "logged-in-user-id",
     "initialMessage": "Bonjour, je suis intéressé par ce bien..."
   }
   ```
4. Backend:
   - Finds property owner
   - Checks if conversation already exists
   - Creates new conversation or returns existing
   - Sends initial message if provided
5. App navigates to chat view with conversation ID

### Viewing Conversations List

1. App calls `GET /conversations/user/{userId}`
2. Backend returns all conversations with:
   - Property details (via relation)
   - Unread count
   - Last message preview
3. App displays list with:
   - Property image and title
   - Last message preview
   - Unread badge

### Chat View

1. App calls `GET /conversations/{id}/messages`
2. Displays messages in timeline
3. Polls for new messages every 20-30 seconds
4. When user opens chat:
   - Call `PATCH /conversations/{id}/mark-read`
   - Clears unread badge

### Sending Message

1. User types message and hits send
2. App calls `POST /messages` with:
   ```json
   {
     "conversationId": "conv-id",
     "senderId": "user-id",
     "content": "Message text"
   }
   ```
3. Message appears in chat immediately
4. Backend sends notification to receiver (future)

---

## Polling Strategy

For real-time-like experience without WebSockets:

```typescript
// In Flutter
Timer.periodic(Duration(seconds: 20), (timer) {
  if (currentConversationId != null) {
    fetchNewMessages(currentConversationId);
  }
  fetchUnreadCount(userId);
});
```

---

## Future Enhancements

1. **Email Notifications**
   - Send email when user receives new message
   - Include property details and message preview
   - Link back to conversation in app

2. **SMS Notifications**
   - Send SMS for urgent messages
   - Configurable per user

3. **Image Attachments**
   - Use `attachmentUrl` and `attachmentType` fields
   - Upload images to server
   - Display in chat

4. **WebSocket Support**
   - Real-time message delivery
   - Typing indicators
   - Online/offline status

5. **Message Search**
   - Search messages by content
   - Filter by date range

6. **Message Reactions**
   - Like/react to messages
   - Quick responses

---

## Database Indexes

The models include indexes for optimal query performance:

**Conversation:**
- `bienImmoId`: Find conversations by property
- `participantIds + lastMessageAt`: Find user's conversations sorted by time

**Message:**
- `conversationId + timestamp`: Get messages in conversation
- `conversationId + isRead`: Find unread messages

---

## Testing

Use the API Explorer at `http://localhost:3000/explorer` to test all endpoints.

**Test Scenario:**
1. Create a conversation: `POST /conversations`
2. Get user's conversations: `GET /conversations/user/{userId}`
3. Send a message: `POST /messages`
4. Get messages: `GET /conversations/{conversationId}/messages`
5. Mark as read: `PATCH /conversations/{conversationId}/mark-read`
6. Check unread count: `GET /conversations/user/{userId}/unread-count`

---

## Error Handling

All endpoints follow standard HTTP error codes:
- `200 OK`: Success
- `204 No Content`: Success (no body returned)
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Example Error Response:**
```json
{
  "error": {
    "statusCode": 404,
    "name": "NotFoundError",
    "message": "Conversation not found"
  }
}
```
