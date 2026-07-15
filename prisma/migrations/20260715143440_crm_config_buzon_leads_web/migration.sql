-- AlterTable
ALTER TABLE "crm_config" ADD COLUMN     "vendedor_leads_web_id" UUID;

-- AddForeignKey
ALTER TABLE "crm_config" ADD CONSTRAINT "crm_config_vendedor_leads_web_id_fkey" FOREIGN KEY ("vendedor_leads_web_id") REFERENCES "vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
