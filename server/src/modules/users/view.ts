import type { User } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';

export type SignInMethod = 'password' | 'google' | 'both';

export function signInMethod(u: Pick<User, 'googleId' | 'passwordHash'>): SignInMethod {
  if (u.googleId && u.passwordHash) return 'both';
  return u.googleId ? 'google' : 'password';
}

/** What the client knows about the signed-in user. */
export async function meView(user: User) {
  const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { fullName: true } });
  return {
    id: user.id,
    email: user.email,
    name: profile?.fullName || user.name || '',
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingComplete: Boolean(user.onboardingCompletedAt),
    signInMethod: signInMethod(user),
    hasPassword: Boolean(user.passwordHash),
    passwordChangedAt: user.passwordChangedAt,
  };
}
