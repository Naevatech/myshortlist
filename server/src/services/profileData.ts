import type { Preferences, Profile } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { asArray } from '../utils/json.js';
import type { Education, Experience, PreferencesData, ProfileData } from '../types/domain.js';

export function toProfileData(p: Profile | null): ProfileData {
  return {
    fullName: p?.fullName ?? '',
    email: p?.email ?? '',
    phone: p?.phone ?? null,
    location: p?.location ?? '',
    headline: p?.headline ?? '',
    summary: p?.summary ?? '',
    experience: asArray<Experience>(p?.experienceJson),
    education: asArray<Education>(p?.educationJson),
    skills: asArray<string>(p?.skillsJson),
  };
}

export function toPreferencesData(p: Preferences | null): PreferencesData {
  return {
    roles: asArray<string>(p?.rolesJson),
    location: p?.location ?? '',
    radiusMiles: p?.radiusMiles ?? 15,
    workStyles: asArray<'remote' | 'hybrid' | 'onsite'>(p?.workStylesJson),
    minSalary: p?.minSalary ?? null,
    rightToWorkUk: p?.rightToWorkUk ?? true,
    needsSponsorship: p?.needsSponsorship ?? false,
  };
}

export async function loadCandidate(userId: string) {
  const [user, profile, prefs] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.preferences.findUnique({ where: { userId } }),
  ]);
  const p = toProfileData(profile);
  if (!p.email) p.email = user.email;
  if (!p.fullName && user.name) p.fullName = user.name;
  return { user, profile: p, prefs: toPreferencesData(prefs) };
}
