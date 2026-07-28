import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function resetPwd() {
  const hash = await bcrypt.hash('Welcome2Ignite', 10);
  await db.user.update({
    where: { email: 'admin@sails.app' },
    data: { password: hash }
  });
  console.log("Password reset successfully.");
}

resetPwd().finally(() => db.$disconnect());
