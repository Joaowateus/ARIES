-- AlterTable
ALTER TABLE "pro_labore_sm_config" ADD COLUMN     "whatsappLoja" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "canalEntrada" TEXT,
ADD COLUMN     "midiaId" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "postCode" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_sm_links" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "pautaId" TEXT,
    "titulo" TEXT,
    "mensagem" TEXT NOT NULL,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_links_cliques" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "visitante" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_links_cliques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_links_slug_key" ON "pro_labore_sm_links"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_links_pautaId_key" ON "pro_labore_sm_links"("pautaId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_links_usuarioId_codigo_key" ON "pro_labore_sm_links"("usuarioId", "codigo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_links_cliques_linkId_em_idx" ON "pro_labore_sm_links_cliques"("linkId", "em");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_links" ADD CONSTRAINT "pro_labore_sm_links_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_links_cliques" ADD CONSTRAINT "pro_labore_sm_links_cliques_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "pro_labore_sm_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

