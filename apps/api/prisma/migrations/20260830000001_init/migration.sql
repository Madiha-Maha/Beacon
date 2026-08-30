-- CreateEnum
CREATE TYPE "HazardType" AS ENUM ('stairs', 'curb', 'vehicle', 'obstacle', 'wet_floor', 'hole', 'drop_off', 'construction', 'blocked_ramp', 'broken_pavement', 'other');

-- CreateEnum
CREATE TYPE "HazardSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "NarrationTier" AS ENUM ('hazard', 'social', 'ambient');

-- CreateEnum
CREATE TYPE "CaregiverLinkStatus" AS ENUM ('pending', 'active', 'revoked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HazardReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "type" "HazardType" NOT NULL,
    "severity" "HazardSeverity" NOT NULL,
    "notes" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HazardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caregiverEmail" TEXT NOT NULL,
    "status" "CaregiverLinkStatus" NOT NULL DEFAULT 'pending',
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedAt" TIMESTAMP(3),

    CONSTRAINT "CaregiverLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "NarrationTier" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,

    CONSTRAINT "NarrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "HazardReport_lat_lng_idx" ON "HazardReport"("lat", "lng");

-- CreateIndex
CREATE INDEX "HazardReport_expiresAt_idx" ON "HazardReport"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverLink_userId_caregiverEmail_key" ON "CaregiverLink"("userId", "caregiverEmail");

-- CreateIndex
CREATE INDEX "NarrationLog_userId_createdAt_idx" ON "NarrationLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "HazardReport" ADD CONSTRAINT "HazardReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverLink" ADD CONSTRAINT "CaregiverLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrationLog" ADD CONSTRAINT "NarrationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
