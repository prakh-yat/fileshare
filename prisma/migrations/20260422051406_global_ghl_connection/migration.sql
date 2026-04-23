-- CreateTable
CREATE TABLE "GhlAppConnection" (
    "id" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" TEXT,
    "refreshTokenId" TEXT,
    "userType" TEXT,
    "companyId" TEXT,
    "locationId" TEXT,
    "externalUserId" TEXT,
    "isBulkInstallation" BOOLEAN,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlAppConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GhlAppConnection_locationId_idx" ON "GhlAppConnection"("locationId");
