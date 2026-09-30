-- CreateTable
CREATE TABLE "dashboard_snapshots" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "openPullRequests" INTEGER NOT NULL,
    "commits7d" INTEGER NOT NULL,
    "activeContributors30d" INTEGER NOT NULL,
    "recentActivity" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_metric_snapshots" (
    "id" UUID NOT NULL,
    "dashboardSnapshotId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "language" TEXT,
    "openIssues" INTEGER NOT NULL,
    "openPullRequests" INTEGER NOT NULL,
    "commits7d" INTEGER NOT NULL,
    "lastActivityAt" TIMESTAMP(3),

    CONSTRAINT "repository_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_snapshots_userId_capturedAt_idx" ON "dashboard_snapshots"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "repository_metric_snapshots_dashboardSnapshotId_idx" ON "repository_metric_snapshots"("dashboardSnapshotId");

-- CreateIndex
CREATE INDEX "repository_metric_snapshots_repositoryId_idx" ON "repository_metric_snapshots"("repositoryId");

-- AddForeignKey
ALTER TABLE "dashboard_snapshots" ADD CONSTRAINT "dashboard_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_metric_snapshots" ADD CONSTRAINT "repository_metric_snapshots_dashboardSnapshotId_fkey" FOREIGN KEY ("dashboardSnapshotId") REFERENCES "dashboard_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_metric_snapshots" ADD CONSTRAINT "repository_metric_snapshots_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
