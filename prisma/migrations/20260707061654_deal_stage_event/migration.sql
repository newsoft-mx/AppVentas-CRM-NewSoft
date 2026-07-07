-- CreateTable
CREATE TABLE "deal_stage_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deal_id" UUID NOT NULL,
    "from_stage_id" UUID,
    "to_stage_id" UUID NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_stage_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_stage_event_deal_id_idx" ON "deal_stage_event"("deal_id");

-- CreateIndex
CREATE INDEX "deal_stage_event_to_stage_id_idx" ON "deal_stage_event"("to_stage_id");

-- AddForeignKey
ALTER TABLE "deal_stage_event" ADD CONSTRAINT "deal_stage_event_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
