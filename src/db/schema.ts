import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * ENUMS
 * ─────────────────────────────────────────────────────────────────────────
 */

// Status of a single application as it moves through the pipeline.
export const applicationStatusEnum = pgEnum("application_status", [
  "submitted",
  "under_review",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
]);

// Whether a placement (company assignment) is confirmed, pending, or fell through.
export const placementStatusEnum = pgEnum("placement_status", [
  "proposed",
  "confirmed",
  "declined",
  "completed",
]);

/**
 * ─────────────────────────────────────────────────────────────────────────
 * CORE TABLES
 * ─────────────────────────────────────────────────────────────────────────
 */

// A program is the top-level container, e.g. "Career Accelerator Cohort 3".
// Designed so the same schema can run multiple concurrent or historical programs.
export const programs = pgTable("programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  applicationsOpenAt: timestamp("applications_open_at", { withTimezone: true }),
  applicationsCloseAt: timestamp("applications_close_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("programs_slug_idx").on(table.slug),
}));

// A track is a distinct path within a program, e.g. "Job Shadowing" vs
// "Professional Training". Kept separate from `programs` because tracks
// often have different eligibility rules, durations, and capacities.
export const tracks = pgTable("tracks", {
  id: uuid("id").defaultRandom().primaryKey(),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  capacity: integer("capacity"),
  eligibilityNotes: text("eligibility_notes"),
}, (table) => ({
  programSlugIdx: uniqueIndex("tracks_program_slug_idx").on(table.programId, table.slug),
}));

// A candidate/applicant. Deliberately program-agnostic: one applicant row
// can apply to multiple programs/tracks over time (re-applying next cohort).
export const applicants = pgTable("applicants", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }),
  linkedinUrl: text("linkedin_url"),
  resumeUrl: text("resume_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("applicants_email_idx").on(table.email),
}));

// A partner organization that can host placements (e.g. a company offering
// job-shadowing seats or internship slots).
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
});

// The application itself: one applicant applying to one track within one
// program. This is the row that actually moves through the status pipeline.
export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicantId: uuid("applicant_id").notNull().references(() => applicants.id, { onDelete: "cascade" }),
  trackId: uuid("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
  status: applicationStatusEnum("status").default("submitted").notNull(),
  score: integer("score"),
  reviewerNotes: text("reviewer_notes"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (table) => ({
  // Prevents a candidate from submitting duplicate applications to the same track.
  applicantTrackIdx: uniqueIndex("applications_applicant_track_idx").on(table.applicantId, table.trackId),
  statusIdx: index("applications_status_idx").on(table.status),
}));

// A placement links an accepted application to a hosting organization.
// Split out from `applications` because one application can, in principle,
// be considered for a placement more than once (e.g. a re-match after a
// company withdraws capacity).
export const placements = pgTable("placements", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  status: placementStatusEnum("status").default("proposed").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
});

/**
 * ─────────────────────────────────────────────────────────────────────────
 * RELATIONS (for Drizzle's relational query API — optional but convenient)
 * ─────────────────────────────────────────────────────────────────────────
 */

export const programsRelations = relations(programs, ({ many }) => ({
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  program: one(programs, { fields: [tracks.programId], references: [programs.id] }),
  applications: many(applications),
}));

export const applicantsRelations = relations(applicants, ({ many }) => ({
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  applicant: one(applicants, { fields: [applications.applicantId], references: [applicants.id] }),
  track: one(tracks, { fields: [applications.trackId], references: [tracks.id] }),
  placements: many(placements),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  placements: many(placements),
}));

export const placementsRelations = relations(placements, ({ one }) => ({
  application: one(applications, { fields: [placements.applicationId], references: [applications.id] }),
  organization: one(organizations, { fields: [placements.organizationId], references: [organizations.id] }),
}));
