import { z } from "zod";

const TimestampSchema = z.unknown();

// System role — controls feature access.
// "participant" — default for any registered user. Can use Coach + Mentor.
// "facilitator" — group analytics (not implemented yet).
// "admin" — set manually via set-admin script. Access to /lab.
export const UserRoleSchema = z.enum(["participant", "facilitator", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Profile role — user-provided demographic. Maps to CLAUDE.md user types.
// Stored at users/{uid}.profile.role to keep separate from system role.
export const UserProfileRoleSchema = z.enum([
  "voluntario",
  "docente",
  "familiar",
  "profesional",
  "otro",
]);
export type UserProfileRole = z.infer<typeof UserProfileRoleSchema>;

export const USER_PROFILE_ROLE_LABELS: Record<UserProfileRole, string> = {
  voluntario: "Voluntario/a",
  docente: "Docente",
  familiar: "Familiar",
  profesional: "Profesional de la salud",
  otro: "Otro",
};

export const UserProfileSchema = z.object({
  role: UserProfileRoleSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: UserRoleSchema,
  profile: UserProfileSchema.optional(),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;
