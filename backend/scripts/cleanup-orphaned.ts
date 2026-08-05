import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphanedReceivables() {
  console.log('--- Iniciando limpeza de contas a receber órfãs ---');

  // Encontra todas as contas a receber ativas que pertencem a uma OS que já foi deletada
  const orphaned = await prisma.accountReceivable.findMany({
    where: {
      deletedAt: null,
      workOrder: {
        NOT: { deletedAt: null }
      }
    },
    include: { workOrder: true }
  });

  console.log(`Encontradas ${orphaned.length} contas para remover.`);

  for (const rec of orphaned) {
    console.log(`Marcando conta ${rec.id} (OS: ${rec.workOrder?.number}) como deletada.`);
    await prisma.accountReceivable.update({
      where: { id: rec.id },
      data: { deletedAt: new Date() }
    });
  }

  console.log('--- Limpeza concluída ---');
  await prisma.$disconnect();
}

cleanupOrphanedReceivables().catch(console.error);
