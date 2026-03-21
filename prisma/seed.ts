import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: pool });

async function main() {
  // ── Currencies ──────────────────────────────────────────────
  const currencies = [
    { code: 'USD', symbol: '$', country: 'United States' },
    { code: 'SAR', symbol: '﷼', country: 'Saudi Arabia' },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    console.log(`✔ Currency: ${c.code} (${c.symbol})`);
  }

  // ── Admin user ───────────────────────────────────────────────
    

  const hash = await bcrypt.hash('test123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@travel.com' },
    update: {},
    create: {
      email: 'admin@travel.com',
      full_name: 'Admin',
      password: hash,
      phone_number: '+10000000000',
      type: 'admin',
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@travel.com' },
    update: {},
    create: {
      email: 'user@travel.com',
      full_name: 'User',
      password: hash,
      phone_number: '+10000000001',
      type: 'user',
    },
  });

  console.log(`✔ Admin user: ${admin.email}`);
  console.log(`✔ Regular user: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
