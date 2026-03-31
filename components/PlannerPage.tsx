import React from 'react';
import GeneratePlannerPage from './planner/GeneratePlannerPage';
import ManualPlannerPage from './planner/ManualPlannerPage';
import PlannerModeSelection from './planner/PlannerModeSelection';
import type { Activity as SavedActivity } from '../types';
import ReservePlanPage from './planner/ReservePlanPage';
import type { ReservationDraft } from '../types/planner';

interface PlannerPageProps {
  routePath: string;
  onNavigate: (path: '/planner' | '/planner/generate' | '/planner/manual' | '/planner/reserve') => void;
  favorites: SavedActivity[];
  reservationDraft: ReservationDraft | null;
  onPrepareReservationDraft: (draft: ReservationDraft) => void;
}

const PlannerPage: React.FC<PlannerPageProps> = ({
  routePath,
  onNavigate,
  favorites,
  reservationDraft,
  onPrepareReservationDraft,
}) => {
  if (routePath === '/planner/generate') {
    return (
      <GeneratePlannerPage
        onNavigate={onNavigate}
        onPrepareReservationDraft={onPrepareReservationDraft}
      />
    );
  }

  if (routePath === '/planner/manual') {
    return (
      <ManualPlannerPage
        onNavigate={onNavigate}
        favorites={favorites}
        onPrepareReservationDraft={onPrepareReservationDraft}
      />
    );
  }

  if (routePath === '/planner/reserve') {
    return <ReservePlanPage draft={reservationDraft} onNavigate={onNavigate} />;
  }

  return <PlannerModeSelection onNavigate={onNavigate} />;
};

export default PlannerPage;
