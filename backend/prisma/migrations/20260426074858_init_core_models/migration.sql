-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PreferenceCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "cardName" TEXT NOT NULL,
    "travelStyle" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "driveMode" TEXT,
    "scenicPreference" TEXT NOT NULL,
    "departureCity" TEXT NOT NULL,
    "companionType" TEXT NOT NULL,
    "travelDays" INTEGER NOT NULL,
    "startDate" DATETIME,
    "weatherMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreferenceCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TravelRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "cardId" INTEGER,
    "recordType" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "resultTitle" TEXT,
    "resultContent" TEXT NOT NULL,
    "weatherInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TravelRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TravelRecord_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PreferenceCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "PreferenceCard_userId_idx" ON "PreferenceCard"("userId");

-- CreateIndex
CREATE INDEX "TravelRecord_userId_createdAt_idx" ON "TravelRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TravelRecord_cardId_idx" ON "TravelRecord"("cardId");
