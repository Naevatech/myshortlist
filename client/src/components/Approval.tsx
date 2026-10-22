import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { newIdempotencyKey } from '../lib/hooks';
import type { ApplicationBrief, ApplyRoute, ApprovalResult } from '../lib/types';
import { Button, ButtonLink } from './Button';
import { StatusDot } from './StatusDot';

export type ApprovalPhase =
  | { kind: 'idle' }
  | { kind: 'approved'; appId: string; sendAt: number }
  | { kind: 'sending'; appId: string }
  | { kind: 'sent'; appId: string }
  | { kind: 'failed'; appId: string };

/** Where an existing application left off, so a reload during the undo window keeps the countdown. */
export function phaseFor(app: ApplicationBrief | null): ApprovalPhase {
  if (!app || app.status !== 'approved' || app.undoneAt) return { kind: 'idle' };
  if (app.sendError === 'failed') return { kind: 'failed', appId: app.id };
  if (app.sendError) return { kind: 'idle' };
  const sendAt = app.scheduledSendAt ? new Date(app.scheduledSendAt).getTime() : 0;
  return sendAt > Date.now() ? { kind: 'approved', appId: app.id, sendAt } : { kind: 'sending', appId: app.id };
}

/**
 * Approve → undo window → send. The server holds the real schedule; this mirrors it and checks the result.
 * `onFinishOnSite` is called when the form could not be submitted for the user.
 */
export function useApproval(matchId: string, initial: ApprovalPhase, onFinishOnSite: () => void) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<ApprovalPhase>(initial);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    queryClient.invalidateQueries({ queryKey: ['match', matchId] });
  }, [queryClient, matchId]);

  const approve = useMutation({
    mutationFn: () => api.post<ApprovalResult>(`/matches/${matchId}/approve`, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (r) => {
      setNow(Date.now());
      setPhase(r.sentAt ? { kind: 'sent', appId: r.applicationId } : { kind: 'approved', appId: r.applicationId, sendAt: new Date(r.scheduledSendAt).getTime() });
    },
  });

  const undo = useMutation({
    mutationFn: (appId: string) => api.post(`/applications/${appId}/undo`),
    onSuccess: () => {
      setPhase({ kind: 'idle' });
      refresh();
    },
    onError: (err, appId) => {
      if (err instanceof ApiError && err.code === 'too_late') setPhase({ kind: 'sending', appId });
    },
  });

  const retry = useMutation({
    mutationFn: (appId: string) => api.post(`/applications/${appId}/retry`),
    onSuccess: (_d, appId) => setPhase({ kind: 'sending', appId }),
  });

  // Countdown, measured against the server's scheduled time.
  useEffect(() => {
    if (phase.kind !== 'approved') return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= phase.sendAt) setPhase({ kind: 'sending', appId: phase.appId });
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  // After the window: check what the server did.
  useEffect(() => {
    if (phase.kind !== 'sending') return;
    let stopped = false;
    let tries = 0;
    const check = async () => {
      if (stopped) return;
      try {
        const a = await api.get<ApplicationBrief>(`/applications/${phase.appId}`);
        if (a.status !== 'approved') {
          setPhase({ kind: 'sent', appId: a.id });
          refresh();
          return;
        }
        if (a.sendError === 'not_supported') {
          refresh();
          onFinishOnSite();
          return;
        }
        if (a.sendError === 'failed') {
          setPhase({ kind: 'failed', appId: a.id });
          refresh();
          return;
        }
      } catch {
        /* keep checking */
      }
      tries++;
      setTimeout(check, tries < 20 ? 1000 : 5000);
    };
    const t = setTimeout(check, 600);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [phase, refresh, onFinishOnSite]);

  const seconds = phase.kind === 'approved' ? Math.max(1, Math.ceil((phase.sendAt - now) / 1000)) : 0;
  return { phase, setPhase, approve, undo, retry, seconds };
}

interface ScreenProps {
  phase: ApprovalPhase;
  seconds: number;
  route: ApplyRoute;
  company: string;
  undoWindowSeconds: number;
  onUndo: () => void;
  onRetry: () => void;
  undoing: boolean;
}

/** Replaces the page content: centred, max 520px, no action bar. */
export function ApprovalScreen({ phase, seconds, route, company, undoWindowSeconds, onUndo, onRetry, undoing }: ScreenProps) {
  const what = route === 'form' ? `submit your application form, CV and cover letter to ${company}` : `send your CV and cover letter to ${company}`;

  if (phase.kind === 'approved' || phase.kind === 'sending') {
    return (
      <div className="v g32 narrow center-block fade-in">
        <StatusDot tone="ok" label="Approved" />
        <div className="v g16">
          <h1>Your application is on its way.</h1>
          {phase.kind === 'approved' ? (
            <p className="mut num" aria-hidden="true">
              We will {what} in {seconds === 1 ? '1 second' : `${seconds} seconds`}. You can still undo this.
            </p>
          ) : (
            <p className="mut">Sending it now.</p>
          )}
          <p className="sr" role="status">
            Approved. You can undo for {undoWindowSeconds} seconds.
          </p>
        </div>
        {phase.kind === 'approved' && (
          <div className="v g8">
            <Button variant="outline" action disabled={undoing} onClick={onUndo}>
              Undo
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (phase.kind === 'failed') {
    return (
      <div className="v g32 narrow center-block fade-in" role="alert">
        <div className="v g16">
          <h1>We could not send this application.</h1>
          <p className="mut">Nothing was sent. Check your connection and try again.</p>
        </div>
        <div className="v g8">
          <Button action onClick={onRetry}>
            Try again
          </Button>
          <ButtonLink variant="text" action to="/today">
            Back to Today
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (phase.kind === 'sent') {
    return (
      <div className="v g32 narrow center-block fade-in">
        <StatusDot tone="ok" label="Sent" />
        <div className="v g16">
          <h1>{route === 'form' ? 'Application submitted.' : 'Application sent.'}</h1>
          <p className="mut">
            {route === 'form' ? 'Your application form, CV and cover letter' : 'Your CV and cover letter'} went to {company}. You can follow
            its progress in Applications.
          </p>
        </div>
        <div className="v g8">
          <ButtonLink action to="/today">
            Back to Today
          </ButtonLink>
          <ButtonLink variant="text" action to="/applications">
            View applications
          </ButtonLink>
        </div>
      </div>
    );
  }
  return null;
}
