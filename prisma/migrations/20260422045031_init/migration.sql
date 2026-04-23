-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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

    CONSTRAINT "GhlConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_supabaseUserId_key" ON "AppUser"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GhlConnection_userId_key" ON "GhlConnection"("userId");

-- CreateIndex
CREATE INDEX "GhlConnection_locationId_idx" ON "GhlConnection"("locationId");

-- AddForeignKey
ALTER TABLE "GhlConnection" ADD CONSTRAINT "GhlConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
