-- CreateTable
CREATE TABLE "LeagueRefresh" (
    "leagueId" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,
    "latestData" JSONB,

    CONSTRAINT "LeagueRefresh_pkey" PRIMARY KEY ("leagueId")
);
