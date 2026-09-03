import { getPrisma } from "../src/prisma.js";

export async function seedDatabase() {
  const prisma = getPrisma();
  const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];
  const relatedSystemNames = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];
  const requesters = [
    { name: "Anong Student", email: "anong.student@example.test", isActive: true },
    { name: "Burin Lecturer", email: "burin.lecturer@example.test", isActive: true },
    { name: "Chalida Staff", email: "chalida.staff@example.test", isActive: true },
    { name: "Darin Researcher", email: "darin.researcher@example.test", isActive: true },
    { name: "Inactive Requester", email: "inactive.requester@example.test", isActive: false },
  ];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }

  for (const requester of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }

  console.log(
    `Seeded ${categoryNames.length} categories, ${relatedSystemNames.length} related systems, and ${requesters.length} requesters.`,
  );
}

async function main() {
  await seedDatabase();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
