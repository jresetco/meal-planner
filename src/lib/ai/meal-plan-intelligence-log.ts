/**
 * Structured logs for gaps and follow-ups in meal-plan intelligence.
 * Search logs for `[meal-plan-intelligence]` or use `code` in observability filters.
 *
 * Roadmap (not logged every request): map historical labels → Recipe.id; seasonal clusters;
 * embedding similarity for swap suggestions; per-household learned weights from edits.
 */
export type MealPlanIntelligenceCode =
  | 'HIST_NONE'
  | 'HIST_NO_MEALS_IN_JSON'
  | 'HIST_TRUNCATED_SUMMARY'
  | 'EDIT_NONE'
  | 'EDIT_SWAP_DETAIL_MISSING'

export const logMealPlanIntelligence = (code: MealPlanIntelligenceCode, detail: string) => {
  console.info(
    '[meal-plan-intelligence]',
    JSON.stringify({ code, detail, t: new Date().toISOString() })
  )
}
