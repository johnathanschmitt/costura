// Bootstrap de produção: cria só o mínimo para alguém conseguir entrar no
// sistema — permissões, papéis e um usuário administrador.
//
// Diferente do seed.ts, que também cria clientes, orçamentos e ordens de
// serviço de demonstração. Em produção esses dados não devem existir, mas um
// banco totalmente vazio não tem nenhum usuário e ninguém consegue logar.
//
// É idempotente (upsert): rodar de novo não duplica nada nem troca a senha de
// um admin que já exista.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
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

  const costureiraPerms = permissions.filter(p =>
    ['read', 'update'].includes(p.action) &&
    ['work-orders', 'customers', 'inventory'].includes(p.resource),
  );
  await prisma.role.upsert({
    where: { name: 'costureira' },
    create: {
      name: 'costureira',
      description: 'Costureira — visualiza e atualiza ordens de serviço',
      permissions: { create: costureiraPerms.map(p => ({ permissionId: p.id })) },
    },
    update: {},
  });

  const email = process.env.ADMIN_EMAIL || 'admin@atelie.local';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Admin ${email} já existe — senha mantida.`);
    return;
  }

  // Sem ADMIN_PASSWORD, gera uma senha aleatória e imprime uma única vez.
  // Melhor do que gravar uma senha conhecida do repositório em produção.
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      roleId: adminRole.id,
    },
  });

  console.log('');
  console.log('  Usuário administrador criado');
  console.log(`  e-mail: ${email}`);
  if (generated) {
    console.log(`  senha:  ${password}`);
    console.log('  Anote agora — ela não será exibida de novo. Troque após o primeiro acesso.');
  } else {
    console.log('  senha:  a definida em ADMIN_PASSWORD');
  }
  console.log('');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
