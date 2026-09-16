-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "agendaAlertaAderenciaPct" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "agendaAlertaDiasConsecutivos" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "agendaAlertaQuedaEfetividadePct" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "agendaLimiarAtencaoPct" DOUBLE PRECISION NOT NULL DEFAULT 50,
ADD COLUMN     "agendaLimiarBomPct" DOUBLE PRECISION NOT NULL DEFAULT 80,
ADD COLUMN     "agendaLimiarEfetividadeAltaPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "agendaLimiarOscilacaoPct" DOUBLE PRECISION NOT NULL DEFAULT 35,
ADD COLUMN     "agendaReconhecimentoSemanas" INTEGER NOT NULL DEFAULT 4;
