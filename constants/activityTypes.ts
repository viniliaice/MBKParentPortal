import type { ActivityType } from '@/data/learningData';

export interface ActivityTypeMeta {
  label: string;
  /** short question-header description shown on the lesson screen */
  description: string;
  color: string;
  icon: string;
}

/**
 * Learning surfaces previously hand-maintained four separate copies of this
 * mapping (app/(tabs)/learning.tsx had three: ACTIVITY_TYPE_LABELS, the
 * ActivityTypeIcon color map, and the mastery-grid mapColors; app/lesson/[id].tsx
 * had a fourth, TYPE_DESCRIPTIONS). One source of truth for all 8 activity
 * types — AGENTS.md already warns that adding a type means touching every
 * switch; this at least stops it from meaning touching four separate maps too.
 */
export const ACTIVITY_TYPES: Record<ActivityType, ActivityTypeMeta> = {
  multipleChoice: { label: 'Multiple Choice', description: 'Choose the correct answer', color: '#3D5AFE', icon: 'radio-button-on' },
  tapCorrect: { label: 'Tap Correct', description: 'Tap the correct answer', color: '#00BCD4', icon: 'hand-right' },
  fillBlank: { label: 'Fill in Blank', description: 'Fill in the blank', color: '#2ECC71', icon: 'pencil' },
  dragOrder: { label: 'Put in Order', description: 'Tap in the correct order', color: '#F59E0B', icon: 'swap-vertical' },
  matchPairs: { label: 'Match Pairs', description: 'Match the pairs', color: '#EC4899', icon: 'git-compare' },
  numberLine: { label: 'Number Line', description: 'Find the number', color: '#8B5CF6', icon: 'analytics' },
  trueFalse: { label: 'True or False', description: 'True or False', color: '#FF5370', icon: 'checkmark-circle' },
  writing: { label: 'Spelling', description: 'Spell it right', color: '#14B8A6', icon: 'text' },
  explorable: { label: 'Explore', description: 'Drag and discover', color: '#22D3EE', icon: 'options' },
};

const FALLBACK: ActivityTypeMeta = { label: 'Unknown', description: '', color: '#8892B0', icon: 'help-circle' };

export function getActivityTypeMeta(type: string): ActivityTypeMeta {
  return ACTIVITY_TYPES[type as ActivityType] ?? FALLBACK;
}
