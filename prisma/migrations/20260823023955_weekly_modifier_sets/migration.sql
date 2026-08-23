-- CreateTable
CREATE TABLE "WeeklyModifierSet" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "modifiers" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "revealAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyModifierSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyModifierSet_season_week_key" ON "WeeklyModifierSet"("season", "week");
