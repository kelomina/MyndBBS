const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/backend/prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

// Add Phase 3 fields to PrivateMessage if not present
if (!content.includes('deletedBy')) {
  content = content.replace(
    "isSystem                 Boolean  @default(false)",
    "isSystem                 Boolean  @default(false)\n  expiresAt                DateTime?\n  deletedBy                String[]"
  );
}

// Add ConversationSetting model if not present
if (!content.includes('model ConversationSetting')) {
  content += `

model ConversationSetting {
  id                  String   @id @default(uuid()) @db.Uuid
  userId              String   @db.Uuid
  partnerId           String   @db.Uuid
  allowTwoSidedDelete Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation("UserConversationSettings", fields: [userId], references: [id], onDelete: Cascade)
  partner             User     @relation("PartnerConversationSettings", fields: [partnerId], references: [id], onDelete: Cascade)

  @@unique([userId, partnerId])
  @@index([userId])
  @@index([partnerId])
}
`;
}

// Add relation to User model
if (!content.includes('UserConversationSettings')) {
  content = content.replace(
    "receivedMessages    PrivateMessage[] @relation(\"ReceivedMessages\")",
    "receivedMessages    PrivateMessage[] @relation(\"ReceivedMessages\")\n  conversationSettings ConversationSetting[] @relation(\"UserConversationSettings\")\n  partnerSettings      ConversationSetting[] @relation(\"PartnerConversationSettings\")"
  );
}

fs.writeFileSync(filePath, content);
console.log('Fixed schema.prisma');
