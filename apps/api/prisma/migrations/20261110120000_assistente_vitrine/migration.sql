-- AlterTable
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN     "midiaUrl" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_sm_motos_estoque" ADD COLUMN     "cilindrada" INTEGER,
ADD COLUMN     "destaques" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "enviosWhatsapp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ficha" JSONB,
ADD COLUMN     "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "km" INTEGER,
ADD COLUMN     "preco" DOUBLE PRECISION,
ADD COLUMN     "versao" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_assistente_loja" (
    "usuarioId" TEXT NOT NULL,
    "mostrarPreco" BOOLEAN NOT NULL DEFAULT false,
    "vitrineRobo" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_loja_pkey" PRIMARY KEY ("usuarioId")
);

