import { z } from 'zod';

export const experienceSchema = z.object({
  title: z.string().default(''),
  company: z.string().default(''),
  start: z.string().default(''),
  end: z.string().default(''),
  bullets: z.array(z.string()).default([]),
});

export const educationSchema = z.object({
  qualification: z.string().default(''),
  institution: z.string().default(''),
  start: z.string().default(''),
  end: z.string().default(''),
});

export const parsedCvSchema = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  headline: z.string().default(''),
  summary: z.string().default(''),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(z.string()).default([]),
  yearsExperience: z.number().nullable().default(null),
});

export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type ParsedCv = z.infer<typeof parsedCvSchema>;

/** The profile as used by matching and tailoring (Profile row plus parsed fields). */
export interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
  location: string;
  headline: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
}

export interface PreferencesData {
  roles: string[];
  location: string;
  radiusMiles: number;
  workStyles: Array<'remote' | 'hybrid' | 'onsite'>;
  minSalary: number | null;
  rightToWorkUk: boolean;
  needsSponsorship: boolean;
}

// ---- Documents ----

export const segmentSchema = z.object({ text: z.string().max(5000), changed: z.boolean().default(false) });
export type Segment = z.infer<typeof segmentSchema>;

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), segments: z.array(segmentSchema) }),
  z.object({ type: z.literal('meta'), segments: z.array(segmentSchema) }),
  z.object({ type: z.literal('section'), segments: z.array(segmentSchema) }),
  z.object({ type: z.literal('paragraph'), segments: z.array(segmentSchema) }),
  z.object({ type: z.literal('entry'), segments: z.array(segmentSchema), aside: z.string().max(200).optional() }),
  z.object({ type: z.literal('bullets'), items: z.array(z.array(segmentSchema)) }),
]);
export const blocksSchema = z.array(blockSchema).max(200);
export type Block = z.infer<typeof blockSchema>;

// ---- Form questions ----

export interface FormQuestion {
  key: string;
  label: string;
  /** What we can fill it from. "motivation" is drafted, "unknown" is left for the user. */
  kind: 'name' | 'email' | 'phone' | 'right_to_work' | 'notice_period' | 'motivation' | 'salary' | 'unknown';
  multiline?: boolean;
}

export interface MatchResult {
  score: number;
  reasons: [string, string, string];
  reasonLine: string;
}
