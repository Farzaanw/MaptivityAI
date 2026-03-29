import React from 'react';
import type { ReservationDraft } from '../../types/planner';

interface ReservePlanPageProps {
  draft: ReservationDraft | null;
  onNavigate: (path: '/planner' | '/planner/generate' | '/planner/manual') => void;
}

const ReservePlanPage: React.FC<ReservePlanPageProps> = ({ draft, onNavigate }) => {
  if (!draft) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#fffaf5_0%,#fffdf9_48%,#f8fafc_100%)] px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <section className="rounded-[36px] border border-amber-100 bg-white/85 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)]">
            <div className="inline-flex rounded-full bg-amber-100 px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-800">
              Reserve Plan
            </div>
            <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">
              Choose a plan before opening reservation prep.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              This page is ready to hold future AI-agent booking actions, but it needs a plan draft first.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/planner')}
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Back to Planner
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_26%),linear-gradient(180deg,#fffaf5_0%,#fffdf9_48%,#f8fafc_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[36px] border border-amber-100 bg-white/85 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.1)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex rounded-full bg-amber-100 px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-800">
              Reserve Plan
            </div>
            <button
              type="button"
              onClick={() => onNavigate(draft.source === 'generated' ? '/planner/generate' : '/planner/manual')}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Back to Plan
            </button>
          </div>

          <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">{draft.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{draft.subtitle}</p>

          <div className="mt-6 rounded-[24px] border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-800">Future AI agent workflow</p>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
              <p>1. Review which itinerary stops are worth booking ahead.</p>
              <p>2. Hand those candidates to a future reservation agent.</p>
              <p>3. Let the agent attempt restaurant, ticket, or timed-entry bookings later.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_18px_70px_rgba(15,23,42,0.08)]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reservation Candidates</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">
                {draft.candidates.length} stop{draft.candidates.length === 1 ? '' : 's'} ready for future agent support
              </h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {draft.source === 'generated' ? 'AI plan' : 'Manual plan'}
            </div>
          </div>

          {draft.candidates.length > 0 ? (
            <div className="grid gap-4">
              {draft.candidates.map((candidate) => (
                <article
                  key={candidate.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {candidate.photoUrl ? (
                        <img src={candidate.photoUrl} alt={candidate.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                          Reserve
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{candidate.dayLabel}</p>
                          <h4 className="mt-2 text-xl font-black text-slate-950">{candidate.name}</h4>
                        </div>
                        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-700">
                          Candidate
                        </div>
                      </div>

                      {candidate.timeLabel && (
                        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {candidate.timeLabel}
                        </p>
                      )}

                      <p className="mt-3 text-sm leading-7 text-slate-600">{candidate.address}</p>

                      {candidate.notes && (
                        <p className="mt-3 text-sm leading-7 text-slate-600">{candidate.notes}</p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {candidate.reservationHint}
                        </span>
                        {candidate.lat != null && candidate.lng != null && (
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                            Map-ready coordinates
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center text-sm leading-7 text-slate-500">
              This plan does not have any activities queued for reservation prep yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ReservePlanPage;
