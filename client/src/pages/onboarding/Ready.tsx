import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, ButtonLink } from '../../components/Button';
import { Loader } from '../../components/Loader';

/** Entering this step finishes onboarding and creates the first matches. */
export function Ready() {
  const queryClient = useQueryClient();
  const started = useRef(false);
  const complete = useMutation({
    mutationFn: () => api.post('/onboarding/complete'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    complete.mutate();
  }, [complete]);

  return (
    <>
      <div className="v g16">
        <h1>You are ready</h1>
        <p className="mut">
          Each morning we will bring you the best new matches. You review every one, and nothing is sent until you approve it.
        </p>
        {complete.isError && (
          <p className="err-t" role="alert">
            We could not finish setting up. Check your connection and try again.
          </p>
        )}
      </div>
      {complete.isError ? (
        <Button action onClick={() => complete.mutate()}>
          Try again
        </Button>
      ) : complete.isSuccess ? (
        <ButtonLink action to="/today">
          Go to Today
        </ButtonLink>
      ) : (
        <Button action disabled aria-describedby="ready-busy">
          Go to Today
        </Button>
      )}
      {complete.isPending && (
        <div id="ready-busy">
          <Loader
            label="Finding your first matches. This can take up to a minute."
            every={4000}
            steps={[
              'Searching UK job listings for your roles',
              'Checking each job against your CV',
              'Writing a tailored CV and cover letter for the best ones',
              'Nearly done. Thank you for waiting.',
            ]}
          />
        </div>
      )}
    </>
  );
}
