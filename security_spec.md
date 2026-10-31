# Firebase Security Specification — Meu Dinheiro (Gestão Financeira)

## 1. Access Control Model
- **Authentication**: Google Sign-In via Firebase Authentication (`signInWithPopup`).
- **Ownership**: Each authenticated user has a single private financial workspace document stored at `/workspaces/{userId}` where `{userId} == request.auth.uid`.
- **Default Deny**: All other paths are denied by default (`allow read, write: if false`).
- **Admin Override**: The application owner (`wesley.diaslima@gmail.com` with `email_verified == true`) or the document owner (`request.auth.uid == userId`) can read and write their own workspace.

## 2. Schema Validation & Bounds
- Required fields on create/update: `uid`, `updatedAt`, `accountsJson`, `cardsJson`, `categoriesJson`, `transactionsJson`, `goalsJson`, `investmentsJson`.
- Immutability: `uid` must match `userId` and cannot be modified on update.
- Field size bounds: JSON payload strings are bounded (max 900,000 characters total document limit < 1MB) to prevent oversized document abuse.
