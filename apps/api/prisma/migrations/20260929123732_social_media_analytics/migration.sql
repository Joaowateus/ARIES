-- AlterTable
ALTER TABLE "pro_labore_social_media_contas" ADD COLUMN     "biografia" TEXT,
ADD COLUMN     "demografia" JSONB,
ADD COLUMN     "distribuicaoAlcance" JSONB,
ADD COLUMN     "seguidoresOnline" JSONB,
ADD COLUMN     "site" TEXT,
ADD COLUMN     "tipoConta" TEXT,
ADD COLUMN     "ultimaSincronizacaoEm" TIMESTAMP(3),
ADD COLUMN     "ultimoErroSync" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_social_media_midias" ADD COLUMN     "formato" TEXT,
ADD COLUMN     "insightsAtualizadoEm" TIMESTAMP(3),
ADD COLUMN     "interacoesTotais" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "navegacaoStory" JSONB,
ADD COLUMN     "respostas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seguidoresGerados" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tempoMedioAssistidoSeg" DOUBLE PRECISION,
ADD COLUMN     "tempoTotalAssistidoSeg" DOUBLE PRECISION,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "visitasPerfil" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visualizacoes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pro_labore_social_media_snapshots" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cliquesSiteDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "comentariosDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "compartilhamentosDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contasEngajadasDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "curtidasDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interacoesDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "respostasDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salvamentosDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seguidoresGanhosDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seguidoresPerdidosDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "toquesLinksDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visualizacoesDia" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "seguidores" DROP NOT NULL;
