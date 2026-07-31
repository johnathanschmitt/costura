import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Permissões ────────────────────────────────────────────────────────────
  const resources = ['customers', 'quotes', 'work-orders', 'services', 'products', 'inventory', 'financial', 'reports', 'settings', 'garments', 'schedule'];
  const actions = ['create', 'read', 'update', 'delete'];

  const permissions = await Promise.all(
    resources.flatMap(resource =>
      actions.map(action =>
        prisma.permission.upsert({
          where: { action_resource: { action, resource } },
          create: { action, resource },
          update: {},
        }),
      ),
    ),
  );

  // ── Roles ─────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    create: {
      name: 'admin',
      description: 'Administrador com acesso total',
      permissions: { create: permissions.map(p => ({ permissionId: p.id })) },
    },
    update: {},
  });

  const atendentePerms = permissions.filter(p =>
    p.action === 'read' ||
    ['customers', 'quotes', 'work-orders', 'schedule'].includes(p.resource),
  );
  await prisma.role.upsert({
    where: { name: 'atendente' },
    create: {
      name: 'atendente',
      description: 'Atendente — acesso a clientes, orçamentos e OS',
      permissions: { create: atendentePerms.map(p => ({ permissionId: p.id })) },
    },
    update: {},
  });

  const cosedeiraPerms = permissions.filter(p =>
    ['read', 'update'].includes(p.action) &&
    ['work-orders', 'customers', 'inventory'].includes(p.resource),
  );
  await prisma.role.upsert({
    where: { name: 'costureira' },
    create: {
      name: 'costureira',
      description: 'Costureira — visualiza e atualiza ordens de serviço',
      permissions: { create: cosedeiraPerms.map(p => ({ permissionId: p.id })) },
    },
    update: {},
  });

  // ── Usuários ──────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@atelie.local' },
    create: {
      name: 'Administrador',
      email: 'admin@atelie.local',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      roleId: adminRole.id,
    },
    update: {},
  });

  // ── Serviços ──────────────────────────────────────────────────────────────
  const serviceData = [
    { name: 'Bainha simples', basePrice: 25, unit: 'un' },
    { name: 'Bainha com forro', basePrice: 45, unit: 'un' },
    { name: 'Ajuste de cós', basePrice: 35, unit: 'un' },
    { name: 'Ajuste de zíper', basePrice: 40, unit: 'un' },
    { name: 'Conserto de rasgão', basePrice: 30, unit: 'un' },
    { name: 'Customização geral', basePrice: 80, unit: 'hora' },
    { name: 'Confecção de vestido sob medida', basePrice: 450, unit: 'un' },
    { name: 'Confecção de blusa sob medida', basePrice: 180, unit: 'un' },
    { name: 'Confecção de calça sob medida', basePrice: 220, unit: 'un' },
    { name: 'Bordado simples', basePrice: 60, unit: 'un' },
    { name: 'Aplicação de pedrarias', basePrice: 90, unit: 'hora' },
    { name: 'Reforma completa de peça', basePrice: 120, unit: 'un' },
  ];

  const createdServices: any[] = [];
  for (const s of serviceData) {
    const existing = await prisma.service.findFirst({ where: { name: s.name, deletedAt: null } });
    const svc = existing ?? await prisma.service.create({ data: s });
    createdServices.push(svc);
  }

  // ── Peças/Roupas ──────────────────────────────────────────────────────────
  const garmentData = [
    { name: 'Vestido Evasê Midi', category: 'Vestido', description: 'Modelagem evasê, comprimento midi, decote redondo. Ideal para uso casual e passeio.' },
    { name: 'Vestido Longo Festa', category: 'Moda Festa', description: 'Vestido longo com cauda, bordado manual no busto, abertura lateral.' },
    { name: 'Blusa Cropped Manga Bufante', category: 'Blusa / Camisa', description: 'Blusa curta com manga bufante, modelagem ajustada ao corpo.' },
    { name: 'Calça Pantalona', category: 'Calça', description: 'Calça de perna larga, cós alto com elástico e zíper.' },
    { name: 'Saia Lápis', category: 'Saia', description: 'Saia modelagem lápis, joelho, fenda traseira, zíper invisível.' },
    { name: 'Conjunto Cropped + Saia', category: 'Conjunto', description: 'Conjunto blusa cropped e saia midi, mesmo tecido, look completo.' },
    { name: 'Casaco Trench Coat', category: 'Casaco / Jaqueta', description: 'Trench coat clássico, cinto, gola de lapela, duplo abotoamento.' },
    { name: 'Vestido Infantil de Festa', category: 'Roupa Infantil', description: 'Vestido infantil com saia rodada, bordado floral, laço nas costas.' },
    { name: 'Biquíni de Renda', category: 'Moda Praia', description: 'Biquíni com sobreposição de renda, bojo removível, regulagem lateral.' },
    { name: 'Vestido Noiva Clássico', category: 'Moda Festa', description: 'Vestido branco com cauda catedral, decote coração, bordado em todo o corpete.' },
  ];

  for (const g of garmentData) {
    const existing = await prisma.garment.findFirst({ where: { name: g.name, deletedAt: null } });
    if (!existing) await prisma.garment.create({ data: g });
  }

  // Só cria dados de exemplo se não existirem clientes
  const customerCount = await prisma.customer.count();
  if (customerCount > 0) {
    console.log('Dados de exemplo já existem. Seed concluído.');
    return;
  }

  // ── Clientes ──────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Ana Paula Ferreira', email: 'ana@email.com', phone: '(11) 98765-4321', notes: 'Prefere tecidos naturais.' } }),
    prisma.customer.create({ data: { name: 'Beatriz Costa Santos', email: 'bia@email.com', phone: '(11) 91234-5678' } }),
    prisma.customer.create({ data: { name: 'Carla Mendes Oliveira', phone: '(21) 99876-5432', notes: 'Noiva — casamento em março.' } }),
    prisma.customer.create({ data: { name: 'Daniela Rocha Lima', email: 'dani@email.com', phone: '(31) 97654-3210' } }),
    prisma.customer.create({ data: { name: 'Eduarda Martins', phone: '(11) 95555-1234' } }),
    prisma.customer.create({ data: { name: 'Fernanda Alves', email: 'fer@email.com', phone: '(21) 94444-9876', notes: 'Cliente VIP, desconto 10%.' } }),
  ]);

  // Medidas para a primeira cliente
  await prisma.bodyMeasurement.create({
    data: {
      customerId: customers[0].id,
      bust: 90, waist: 72, hip: 96, shoulder: 38,
      backLength: 40, frontLength: 38, sleeveLength: 58,
      inseam: 75, thigh: 58, neckCirc: 34, wrist: 16,
      version: 1,
    },
  });

  // ── Orçamentos ────────────────────────────────────────────────────────────
  const quote1 = await prisma.quote.create({
    data: {
      number: 'ORC-00001',
      customerId: customers[0].id,
      status: 'APPROVED',
      validUntil: new Date(Date.now() + 30 * 86400000),
      total: 475,
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[6].id, description: 'Confecção de vestido sob medida', quantity: 1, unitPrice: 450, total: 450, order: 0 },
          { type: 'SERVICE', serviceId: createdServices[0].id, description: 'Bainha simples', quantity: 1, unitPrice: 25, total: 25, order: 1 },
        ],
      },
    },
  });

  const quote2 = await prisma.quote.create({
    data: {
      number: 'ORC-00002',
      customerId: customers[1].id,
      status: 'DRAFT',
      total: 140,
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[2].id, description: 'Ajuste de cós', quantity: 2, unitPrice: 35, total: 70, order: 0 },
          { type: 'SERVICE', serviceId: createdServices[3].id, description: 'Ajuste de zíper', quantity: 1, unitPrice: 40, total: 40, order: 1 },
          { type: 'SERVICE', serviceId: createdServices[4].id, description: 'Conserto de rasgão', quantity: 1, unitPrice: 30, total: 30, order: 2 },
        ],
      },
    },
  });

  const quote3 = await prisma.quote.create({
    data: {
      number: 'ORC-00003',
      customerId: customers[2].id,
      status: 'APPROVED',
      total: 1200,
      notes: 'Vestido de noiva com bordado manual.',
      items: {
        create: [
          { type: 'CUSTOM', description: 'Vestido de noiva bordado', quantity: 1, unitPrice: 1200, total: 1200, order: 0 },
        ],
      },
    },
  });

  // ── Ordens de Serviço ─────────────────────────────────────────────────────
  const yesterday = new Date(Date.now() - 86400000);
  const nextWeek = new Date(Date.now() + 7 * 86400000);
  const lastWeek = new Date(Date.now() - 7 * 86400000);

  // OS gerada a partir do ORC-00001
  await prisma.workOrder.create({
    data: {
      number: 'OS-00001',
      customerId: customers[0].id,
      quoteId: quote1.id,
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: nextWeek,
      startedAt: yesterday,
      total: 475,
      notes: 'Confecção de vestido sob medida + bainha.',
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[6].id, description: 'Confecção de vestido sob medida', quantity: 1, unitPrice: 450, total: 450, order: 0 },
          { type: 'SERVICE', serviceId: createdServices[0].id, description: 'Bainha simples', quantity: 1, unitPrice: 25, total: 25, order: 1 },
        ],
      },
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 'OS-00002',
      customerId: customers[3].id,
      status: 'PENDING',
      priority: 'NORMAL',
      dueDate: nextWeek,
      total: 180,
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[7].id, description: 'Confecção de blusa sob medida', quantity: 1, unitPrice: 180, total: 180, order: 0 },
        ],
      },
    },
  });

  // OS vencida (para testar notificações)
  await prisma.workOrder.create({
    data: {
      number: 'OS-00003',
      customerId: customers[4].id,
      status: 'PENDING',
      priority: 'URGENT',
      dueDate: lastWeek,
      total: 120,
      notes: 'URGENTE — cliente aguardando.',
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[11].id, description: 'Reforma completa de peça', quantity: 1, unitPrice: 120, total: 120, order: 0 },
        ],
      },
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 'OS-00004',
      customerId: customers[5].id,
      status: 'DONE',
      priority: 'NORMAL',
      dueDate: yesterday,
      completedAt: yesterday,
      total: 220,
      items: {
        create: [
          { type: 'SERVICE', serviceId: createdServices[8].id, description: 'Confecção de calça sob medida', quantity: 1, unitPrice: 220, total: 220, order: 0 },
        ],
      },
    },
  });

  // ── Contas a Receber ──────────────────────────────────────────────────────
  await prisma.accountReceivable.createMany({
    data: [
      {
        customerId: customers[0].id,
        description: 'OS-00001 — Vestido sob medida',
        amount: 475,
        paidAmount: 0,
        dueDate: nextWeek,
        status: 'PENDING',
      },
      {
        customerId: customers[5].id,
        description: 'OS-00004 — Calça sob medida',
        amount: 220,
        paidAmount: 100,
        dueDate: yesterday,
        status: 'OVERDUE',
      },
      {
        customerId: customers[3].id,
        description: 'OS-00002 — Blusa sob medida (sinal)',
        amount: 90,
        paidAmount: 90,
        dueDate: lastWeek,
        paidAt: lastWeek,
        status: 'PAID',
      },
    ],
  });

  // ── Contas a Pagar ────────────────────────────────────────────────────────
  await prisma.accountPayable.createMany({
    data: [
      {
        description: 'Fornecedor tecidos — NF 1234',
        category: 'Matéria-prima',
        amount: 380,
        paidAmount: 0,
        dueDate: nextWeek,
        status: 'PENDING',
      },
      {
        description: 'Aluguel do ateliê — Julho',
        category: 'Aluguel',
        amount: 1200,
        paidAmount: 1200,
        dueDate: lastWeek,
        paidAt: lastWeek,
        status: 'PAID',
      },
    ],
  });

  console.log('Seed concluído. Login: admin@atelie.local / Admin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
