-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('API', 'CURATED', 'DERIVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ChangeKind" AS ENUM ('MODEL_ADDED', 'MODEL_REMOVED', 'MODEL_UPDATED', 'OFFERING_ADDED', 'OFFERING_REMOVED', 'PRICE_CHANGED', 'BENCHMARK_CHANGED');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('CHAT', 'REASONING', 'MULTIMODAL', 'IMAGE_GENERATION', 'AUDIO', 'VIDEO', 'EMBEDDING', 'ROUTER');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'ALIAS', 'REMOVED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INPUT', 'OUTPUT');

-- CreateEnum
CREATE TYPE "PriceComponent" AS ENUM ('INPUT', 'OUTPUT', 'CACHE_READ', 'CACHE_WRITE', 'REASONING', 'IMAGE_INPUT', 'AUDIO_INPUT', 'IMAGE_OUTPUT', 'AUDIO_OUTPUT', 'WEB_SEARCH', 'REQUEST');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PER_MILLION_TOKENS', 'PER_IMAGE', 'PER_SEARCH', 'PER_REQUEST', 'PER_MILLION_UNITS');

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "description" TEXT,
    "termsNote" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB,
    "errors" JSONB,
    "stages" JSONB,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL,
    "modelId" TEXT,
    "subject" TEXT NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "headquarters" TEXT,
    "foundedYear" INTEGER,
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Model" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "canonicalSlug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "labId" TEXT NOT NULL,
    "familyId" TEXT,
    "type" "ModelType" NOT NULL DEFAULT 'CHAT',
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "aliasTargetSlug" TEXT,
    "releasedAt" TIMESTAMP(3),
    "contextLength" INTEGER,
    "maxOutputTokens" INTEGER,
    "tokenizer" TEXT,
    "huggingFaceId" TEXT,
    "isOpenWeights" BOOLEAN NOT NULL DEFAULT false,
    "knowledgeCutoff" TEXT,
    "expiresAt" TIMESTAMP(3),
    "reasoningMandatory" BOOLEAN NOT NULL DEFAULT false,
    "supportedParams" TEXT[],
    "minInputPrice" DECIMAL(18,6),
    "minOutputPrice" DECIMAL(18,6),
    "blendedPrice" DECIMAL(18,6),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "providerCount" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modality" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelModality" (
    "modelId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,

    CONSTRAINT "ModelModality_pkey" PRIMARY KEY ("modelId","modalityId","direction")
);

-- CreateTable
CREATE TABLE "Capability" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelCapability" (
    "modelId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "ModelCapability_pkey" PRIMARY KEY ("modelId","capabilityId")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "headquarters" TEXT,
    "datacenters" TEXT[],
    "privacyPolicyUrl" TEXT,
    "termsUrl" TEXT,
    "statusPageUrl" TEXT,
    "labId" TEXT,
    "offeringCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "contextLength" INTEGER,
    "maxOutputTokens" INTEGER,
    "maxPromptTokens" INTEGER,
    "quantization" TEXT,
    "sourceStatus" INTEGER,
    "uptime1d" DOUBLE PRECISION,
    "supportsImplicitCaching" BOOLEAN NOT NULL DEFAULT false,
    "supportedParams" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "component" "PriceComponent" NOT NULL,
    "unit" "PriceUnit" NOT NULL,
    "amountUsd" DECIMAL(18,6),
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "minPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "component" "PriceComponent" NOT NULL,
    "amountUsd" DECIMAL(18,6),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scaleMin" DOUBLE PRECISION NOT NULL,
    "scaleMax" DOUBLE PRECISION,
    "scaleLabel" TEXT NOT NULL,
    "higherIsBetter" BOOLEAN NOT NULL DEFAULT true,
    "methodologyUrl" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkResult" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION,
    "sourceRank" INTEGER,
    "extra" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "BenchmarkResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelScore" (
    "modelId" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "overall" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "capability" DOUBLE PRECISION,
    "coding" DOUBLE PRECISION,
    "agentic" DOUBLE PRECISION,
    "costEfficiency" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "context" DOUBLE PRECISION,
    "availability" DOUBLE PRECISION,
    "versatility" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelScore_pkey" PRIMARY KEY ("modelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_slug_key" ON "DataSource"("slug");

-- CreateIndex
CREATE INDEX "IngestionJob_sourceId_startedAt_idx" ON "IngestionJob"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_createdAt_idx" ON "ChangeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_modelId_createdAt_idx" ON "ChangeEvent"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeEvent_kind_createdAt_idx" ON "ChangeEvent"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_slug_key" ON "ModelFamily"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_labId_name_key" ON "ModelFamily"("labId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Model_slug_key" ON "Model"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Model_externalId_key" ON "Model"("externalId");

-- CreateIndex
CREATE INDEX "Model_labId_idx" ON "Model"("labId");

-- CreateIndex
CREATE INDEX "Model_familyId_idx" ON "Model"("familyId");

-- CreateIndex
CREATE INDEX "Model_type_status_idx" ON "Model"("type", "status");

-- CreateIndex
CREATE INDEX "Model_releasedAt_idx" ON "Model"("releasedAt");

-- CreateIndex
CREATE INDEX "Model_contextLength_idx" ON "Model"("contextLength");

-- CreateIndex
CREATE INDEX "Model_blendedPrice_idx" ON "Model"("blendedPrice");

-- CreateIndex
CREATE INDEX "Model_minInputPrice_idx" ON "Model"("minInputPrice");

-- CreateIndex
CREATE INDEX "Model_minOutputPrice_idx" ON "Model"("minOutputPrice");

-- CreateIndex
CREATE INDEX "Model_name_idx" ON "Model"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Modality_slug_key" ON "Modality"("slug");

-- CreateIndex
CREATE INDEX "ModelModality_modalityId_direction_idx" ON "ModelModality"("modalityId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "Capability_slug_key" ON "Capability"("slug");

-- CreateIndex
CREATE INDEX "ModelCapability_capabilityId_idx" ON "ModelCapability"("capabilityId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "Offering_providerId_idx" ON "Offering"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_modelId_tag_key" ON "Offering"("modelId", "tag");

-- CreateIndex
CREATE INDEX "Price_component_amountUsd_idx" ON "Price"("component", "amountUsd");

-- CreateIndex
CREATE UNIQUE INDEX "Price_offeringId_component_minPromptTokens_key" ON "Price"("offeringId", "component", "minPromptTokens");

-- CreateIndex
CREATE INDEX "PriceSnapshot_offeringId_component_capturedAt_idx" ON "PriceSnapshot"("offeringId", "component", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_slug_key" ON "Benchmark"("slug");

-- CreateIndex
CREATE INDEX "Benchmark_category_idx" ON "Benchmark"("category");

-- CreateIndex
CREATE INDEX "BenchmarkResult_modelId_idx" ON "BenchmarkResult"("modelId");

-- CreateIndex
CREATE INDEX "BenchmarkResult_benchmarkId_score_idx" ON "BenchmarkResult"("benchmarkId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkResult_benchmarkId_modelId_key" ON "BenchmarkResult"("benchmarkId", "modelId");

-- CreateIndex
CREATE INDEX "ModelScore_overall_idx" ON "ModelScore"("overall");

-- CreateIndex
CREATE INDEX "ModelScore_value_idx" ON "ModelScore"("value");

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEvent" ADD CONSTRAINT "ChangeEvent_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelFamily" ADD CONSTRAINT "ModelFamily_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ModelFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelModality" ADD CONSTRAINT "ModelModality_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelModality" ADD CONSTRAINT "ModelModality_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelCapability" ADD CONSTRAINT "ModelCapability_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelCapability" ADD CONSTRAINT "ModelCapability_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelScore" ADD CONSTRAINT "ModelScore_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;
