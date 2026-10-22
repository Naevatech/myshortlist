import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAuth } from './lib/auth';

const Landing = lazy(() => import('./pages/Landing'));
const Privacy = lazy(() => import('./pages/Info').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Info').then((m) => ({ default: m.Terms })));
const Cookies = lazy(() => import('./pages/Info').then((m) => ({ default: m.Cookies })));
const Contact = lazy(() => import('./pages/Info').then((m) => ({ default: m.Contact })));
const VerifyCode = lazy(() => import('./pages/VerifyCode'));
const SignIn = lazy(() => import('./pages/auth/SignIn'));
const SignUp = lazy(() => import('./pages/auth/SignUp'));
const Forgot = lazy(() => import('./pages/auth/Forgot'));
const Reset = lazy(() => import('./pages/auth/Reset'));
const SignedOut = lazy(() => import('./pages/auth/SignedOut'));
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'));
const ReplaceCv = lazy(() => import('./pages/onboarding/ReplaceCv'));
const Today = lazy(() => import('./pages/Today'));
const JobReview = lazy(() => import('./pages/JobReview'));
const CheckAnswers = lazy(() => import('./pages/CheckAnswers'));
const FinishOnSite = lazy(() => import('./pages/FinishOnSite'));
const Applications = lazy(() => import('./pages/Applications'));
const ApplicationDetail = lazy(() => import('./pages/ApplicationDetail'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

export function AppRoutes() {
  return (
    <Routes>
      {(
        [
          ['/', <Landing />],
          ['/signin', <SignIn />],
          ['/signup', <SignUp />],
          ['/forgot', <Forgot />],
          ['/signed-out', <SignedOut />],
        ] as const
      ).map(([path, el]) => (
        <Route key={path} path={path} element={<PublicOnly>{el}</PublicOnly>} />
      ))}
      {/* Verify handles signed-out and unverified visitors itself; Reset works whether or not you are signed in. */}
      <Route path="/verify" element={<VerifyCode />} />
      <Route path="/reset" element={<Reset />} />
      {/* Information pages linked from the landing page footer: open to everyone. */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/contact" element={<Contact />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth onboarded={false}>
            <Onboarding />
          </RequireAuth>
        }
      />
      {(
        [
          ['/today', <Today />],
          ['/jobs/:matchId', <JobReview />],
          ['/jobs/:matchId/answers', <CheckAnswers />],
          ['/jobs/:matchId/finish', <FinishOnSite />],
          ['/applications', <Applications />],
          ['/applications/:id', <ApplicationDetail />],
          ['/profile', <Profile />],
          ['/profile/cv', <ReplaceCv />],
          ['/settings', <Settings />],
        ] as const
      ).map(([path, el]) => (
        <Route key={path} path={path} element={<RequireAuth>{el}</RequireAuth>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
