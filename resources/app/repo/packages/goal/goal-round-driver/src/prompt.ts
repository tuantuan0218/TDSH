/** Model-visible continuation prompt for one same-session goal round. */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { GoalView } from '@deepseek-ai/dsh-goal'

/**
 * Render the complete goal-round instruction retained in session history.
 * @param goal - exact active goal revision being admitted.
 * @param round - next positive round number.
 * @param workspaceRoot - the session's canonical project root; when present the
 *   round is bounded to that project (files, subgoals, and tools), absent only
 *   for sessions without a recorded cwd.
 * @returns a fresh one-block prompt for `Agent.followup()`.
 */
export function renderGoalRoundPrompt(
  goal: GoalView,
  round: number,
  workspaceRoot?: string,
): ContentBlock[] {
  const boundary = workspaceRoot === undefined || workspaceRoot.length === 0
    ? ''
    : `\n\nProject boundary: this goal belongs to the project rooted at ${JSON.stringify(workspaceRoot)}. `
      + 'Read, modify, and run tools only inside that project; any subgoal, plan, or file you derive '
      + 'must stay within it. Do not touch paths outside the project root unless the configured '
      + 'file-sandbox policy explicitly permits them. Treat the project root as the sole authority '
      + 'for what this goal may affect.'
  return [{
    type: 'text',
    text: '<goal_round>\n'
      + `Objective: ${JSON.stringify(goal.objective)}\n`
      + `Round: ${round}/${goal.maxGoalRounds}\n`
      + boundary
      + '\n\nContinue working toward the objective in this same session. Treat the current workspace, '
      + 'tool results, and durable session state as authoritative; inspect them instead of assuming '
      + 'earlier narration is still current. Make concrete progress and verify the result. Before '
      + 'claiming completion, gather evidence that the whole objective is achieved, read the current '
      + 'goal, and mark it complete. If work remains, leave the goal active for the next round. Follow '
      + 'the configured goal-tool policy before reporting a blocker.\n'
      + '</goal_round>',
  }]
}
