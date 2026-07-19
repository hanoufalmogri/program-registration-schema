import { db } from "./index";
import { programs, tracks, applicants, organizations, applications, placements } from "./schema";

async function main() {
  console.log("Seeding database...");

  const [program] = await db
    .insert(programs)
    .values({
      name: "Career Accelerator Cohort 4",
      slug: "career-accelerator-c4",
      description: "A cohort-based program pairing candidates with job shadowing and professional training opportunities.",
      applicationsOpenAt: new Date("2026-05-01"),
      applicationsCloseAt: new Date("2026-06-01"),
    })
    .returning();

  const [jobShadowing, professionalTraining] = await db
    .insert(tracks)
    .values([
      {
        programId: program.id,
        name: "Job Shadowing",
        slug: "job-shadowing",
        capacity: 40,
        eligibilityNotes: "Open to current students.",
      },
      {
        programId: program.id,
        name: "Professional Training",
        slug: "professional-training",
        capacity: 25,
        eligibilityNotes: "Open to recent graduates (within 2 years).",
      },
    ])
    .returning();

  const seededApplicants = await db
    .insert(applicants)
    .values([
      { fullName: "Sample Applicant One", email: "applicant1@example.com", city: "Riyadh" },
      { fullName: "Sample Applicant Two", email: "applicant2@example.com", city: "Jeddah" },
      { fullName: "Sample Applicant Three", email: "applicant3@example.com", city: "Dammam" },
    ])
    .returning();

  const seededOrgs = await db
    .insert(organizations)
    .values([
      { name: "Partner Company A", contactEmail: "hr@partnera.example.com" },
      { name: "Partner Company B", contactEmail: "hr@partnerb.example.com" },
    ])
    .returning();

  const seededApplications = await db
    .insert(applications)
    .values([
      { applicantId: seededApplicants[0].id, trackId: jobShadowing.id, status: "accepted", score: 92 },
      { applicantId: seededApplicants[1].id, trackId: professionalTraining.id, status: "shortlisted", score: 78 },
      { applicantId: seededApplicants[2].id, trackId: jobShadowing.id, status: "rejected", score: 55 },
    ])
    .returning();

  await db.insert(placements).values([
    {
      applicationId: seededApplications[0].id,
      organizationId: seededOrgs[0].id,
      status: "confirmed",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    },
  ]);

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
