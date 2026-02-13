import { onchainTable, relations, onchainEnum } from "ponder";

// Enum for attachment type
export const attachmentType = onchainEnum("attachment_type", [
  "ENCRYPTED",
  "PLAIN",
]);

// Enum for denomination unit
export const denominationUnit = onchainEnum("denomination_unit", [
  "PER_ITEM",
  "PER_HOUR",
  "PER_DAY",
  "PER_BYTE",
  "PER_1000_TOKEN",
]);

// Main IP table (corresponds to IPDetails type)
export const ip = onchainTable("ip", (t) => ({
  id: t.text().primaryKey(),
  tokenId: t.bigint().notNull(), // Note: Ponder doesn't support unique constraints
  name: t.text().notNull(),
  description: t.text().notNull(),
  image: t.text().notNull(),
  externalUrl: t.text().notNull(),
}));

// Attachment table (one-to-many with IP)
export const attachment = onchainTable("attachment", (t) => ({
  id: t.text().primaryKey(),
  ipId: t.text().notNull(), // Foreign key to ip table
  name: t.text().notNull(),
  type: attachmentType().notNull(),
  description: t.text().notNull(),
  fileType: t.text().notNull(),
  fileSizeBytes: t.bigint().notNull(),
  uri: t.text().notNull(),
}));

// Campaign table (one-to-many with IP)
export const campaign = onchainTable("campaign", (t) => ({
  id: t.text().primaryKey(),
  ipId: t.text().notNull(), // Foreign key to ip table
  licenseAddress: t.hex().notNull(),
  numeraireAddress: t.hex().notNull(),
  poolId: t.hex().notNull(),
  denominationUnit: denominationUnit().notNull(),
  denominationAmount: t.bigint().notNull(),
}));

// Define relationships
export const ipRelations = relations(ip, ({ many }) => ({
  attachments: many(attachment),
  campaigns: many(campaign),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
  ip: one(ip, {
    fields: [attachment.ipId],
    references: [ip.id],
  }),
}));

export const campaignRelations = relations(campaign, ({ one }) => ({
  ip: one(ip, {
    fields: [campaign.ipId],
    references: [ip.id],
  }),
}));
