import { runBasicTests } from "../../../basic-tests"
import { PrismaClient } from "@prisma/client"
import { PrismaAdapter } from "../src"
const prisma = new PrismaClient()

runBasicTests({
  adapter: PrismaAdapter(prisma),
  db: {
    disconnect: async () => await prisma.$disconnect(),
    verificationToken: (identifier_token) =>
      prisma.verificationToken.findUnique({
        where: { identifier_token },
      }),
    user: (id) => prisma.user.findUnique({ where: { id } }),
    account: (provider_providerAccountId) =>
      prisma.account.findUnique({
        where: { provider_providerAccountId },
      }),
    session: (sessionToken) =>
      prisma.session.findUnique({ where: { sessionToken } }),
  },
})
