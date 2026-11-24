# JARVIS AI Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: `/users/{userId}` contains user email and personal memory notes. Only the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) can read, create, or update their own profile. Blanket `list` on `/users` is forbidden.
2. **Conversation Ownership**: Every `/conversations/{conversationId}` document belongs strictly to `ownerId == request.auth.uid`. Unverified users or other users cannot read, list, create, update, or delete another user's conversations.
3. **Master Gate & Atomicity on Messages**: Every `/conversations/{conversationId}/messages/{messageId}` belongs to an existing parent conversation whose `ownerId == request.auth.uid` (verified via `getAfter` on create and `get` on get/delete). Messages are immutable once written (no client updates allowed).
4. **Immutable Ownership & Temporal Integrity**: `uid`, `ownerId`, and `createdAt` cannot be modified after creation. `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **Resource Bounds**: Document IDs match `^[a-zA-Z0-9_\-]+$` (<= 128 chars). All strings and arrays have strict max lengths (`content <= 30000`, `memoryNotes <= 2000`, `groundingLinks.size() <= 10`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Read**: Read `/conversations/conv1` with `auth == null`.
2. **Cross-User Profile Read (PII Leak)**: User B reads `/users/userA`.
3. **Blanket User List**: User A lists `/users`.
4. **Cross-User Conversation List**: User B runs list query on `/conversations` without `where('ownerId', '==', 'userB')`.
5. **Owner Spoofing on Create**: User A creates `/conversations/conv1` with `ownerId: "userB"`.
6. **Shadow Field Injection**: User A creates `/users/userA` with extra field `isAdmin: true`.
7. **Unverified Email Write**: User A with `email_verified: false` attempts to create `/conversations/conv1`.
8. **Timestamp Forgery**: User A creates `/conversations/conv1` with client-supplied past `createdAt`.
9. **Immutable Field Tampering**: User A updates `/conversations/conv1` trying to change `ownerId` or `createdAt`.
10. **ID Poisoning**: User A writes `/conversations/bad$id` violating `^[a-zA-Z0-9_\-]+$`.
11. **Orphaned Message Injection**: User B creates `/conversations/convA/messages/msg1` inside User A's conversation.
12. **Array/String Exhaustion**: User A creates message with `groundingLinks` containing 11 items or `content` > 30,000 chars.
