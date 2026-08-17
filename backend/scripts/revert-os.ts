import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function revertOS(osNumber: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { number: osNumber },
  });

  if (!wo) {
    console.error(`OS ${osNumber} não encontrada.`);
    process.exit(1);
  }

  console.log(`Revertendo status da OS ${osNumber} (ID: ${wo.id})...`);

  await prisma.workOrder.update({
    where: { id: wo.id },
    data: { status: 'PENDING' },
  });

  console.log('Status alterado para PENDING. Agora você pode estornar os pagamentos e deletar a OS pelo sistema.');
  await prisma.$disconnect();
}

const osNumber = process.argv[2];
if (!osNumber) {
  console.error('Por favor, informe o número da OS (ex: OS-00005)');
  process.exit(1);
}

revertOS(osNumber);
