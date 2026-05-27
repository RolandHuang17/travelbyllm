-- CreateTable
CREATE TABLE "FavoritePlace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "placeKey" TEXT NOT NULL,
    "amapPoiId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "cityName" TEXT,
    "district" TEXT,
    "longitude" REAL NOT NULL,
    "latitude" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FavoritePlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePlace_userId_placeKey_key" ON "FavoritePlace"("userId", "placeKey");

-- CreateIndex
CREATE INDEX "FavoritePlace_userId_updatedAt_idx" ON "FavoritePlace"("userId", "updatedAt");
