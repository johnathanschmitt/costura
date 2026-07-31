CREATE TABLE "business_info" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL DEFAULT 'Ateliê de Costura',
  "logoBase64"  TEXT,
  "tagline"     TEXT,
  "address"     TEXT,
  "city"        TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "website"     TEXT,
  "taxId"       TEXT,
  "footerText"  TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_info_pkey" PRIMARY KEY ("id")
);
