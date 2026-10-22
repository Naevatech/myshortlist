import { useTitle } from '../../lib/hooks';
import { AuthLayout } from '../../components/AuthLayout';
import { ButtonLink } from '../../components/Button';

export default function SignedOut() {
  useTitle('Signed out');
  return (
    <AuthLayout>
      <div className="v g8">
        <h1>You have signed out.</h1>
        <p className="mut">Your matches, documents and applications are saved. Sign in again whenever you are ready.</p>
      </div>
      <ButtonLink block to="/signin">
        Sign in
      </ButtonLink>
    </AuthLayout>
  );
}
