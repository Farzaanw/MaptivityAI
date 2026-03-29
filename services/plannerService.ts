import type {
  GeneratedPlan,
  GeneratedPlanActivity,
  GeneratedDayPlan,
  PlannerResponse,
  PlannerResponsePlan,
} from '../types/planner';

function inferDayNumber(time: string, fallbackDays: number): number {
  const match = time.match(/day\s*(\d+)/i);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return Math.max(1, Math.min(fallbackDays || 1, 1));
}

function normalizePlan(plan: PlannerResponsePlan): GeneratedPlan {
  const activities: GeneratedPlanActivity[] = plan.activities.map((activity, index) => ({
    id: `${plan.id}-activity-${index + 1}`,
    order: index + 1,
    dayNumber: inferDayNumber(activity.time, plan.days),
    name: activity.name,
    time: activity.time,
    location: activity.location,
    description: activity.description,
  }));

  const groupedByDay = activities.reduce<Map<number, GeneratedPlanActivity[]>>((accumulator, activity) => {
    const dayActivities = accumulator.get(activity.dayNumber) ?? [];
    dayActivities.push(activity);
    accumulator.set(activity.dayNumber, dayActivities);
    return accumulator;
  }, new Map());

  const dayPlans: GeneratedDayPlan[] = Array.from(groupedByDay.entries())
    .sort(([leftDay], [rightDay]) => leftDay - rightDay)
    .map(([dayNumber, dayActivities]) => ({
      dayNumber,
      activities: dayActivities,
    }));

  return {
    id: plan.id,
    title: plan.title,
    summary: plan.summary,
    days: plan.days,
    activities,
    dayPlans,
  };
}

export async function generateItinerary(prompt: string): Promise<GeneratedPlan[]> {
  const baseUrl = import.meta.env.DEV ? 'http://localhost:5050' : '';

  const response = await fetch(`${baseUrl}/api/planner/itinerary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json() as PlannerResponse & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || 'Unable to generate itinerary.');
  }

  if (!Array.isArray(data.plans) || data.plans.length !== 3) {
    throw new Error('The planner returned an invalid set of travel plans.');
  }

  return data.plans.map(normalizePlan);
}
