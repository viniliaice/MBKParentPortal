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
  // Premium interactive engine types — see ActivityRenderer.tsx's kind ->
  // component mapping comment for which of these share one underlying
  // component (they're still distinct entries here for lesson-preview UI).
  interactiveSimulation: { label: 'Simulation', description: 'Play with a live simulation', color: '#22D3EE', icon: 'options' },
  interactiveDiagram: { label: 'Diagram', description: 'Explore a labelled diagram', color: '#8B5CF6', icon: 'locate' },
  parameterExperiment: { label: 'Experiment', description: 'Drag variables and observe', color: '#22D3EE', icon: 'options' },
  buildChallenge: { label: 'Build Challenge', description: 'Assemble the right parts', color: '#F59E0B', icon: 'construct' },
  causeEffectExplorer: { label: 'Cause & Effect', description: 'Trigger it and watch what happens', color: '#2ECC71', icon: 'play' },
  systemBuilder: { label: 'System Builder', description: 'Assemble the right parts', color: '#F59E0B', icon: 'construct' },
  physicsPlayground: { label: 'Playground', description: 'Play with a live simulation', color: '#22D3EE', icon: 'options' },
  animatedProcess: { label: 'Process', description: 'Watch a process unfold', color: '#2ECC71', icon: 'play' },
  guidedDiscovery: { label: 'Discover', description: 'Tap to reveal facts', color: '#EC4899', icon: 'sparkles' },
  predictionChallenge: { label: 'Predict', description: 'Guess before you see', color: '#FF5370', icon: 'help-buoy' },
  interactiveTimeline: { label: 'Timeline', description: 'Watch a process unfold', color: '#2ECC71', icon: 'play' },
  hotspotExplorer: { label: 'Hotspots', description: 'Tap to explore a diagram', color: '#8B5CF6', icon: 'locate' },
  measurementTool: { label: 'Measure', description: 'Drag variables and observe', color: '#22D3EE', icon: 'options' },
  dragMechanism: { label: 'Drag Mechanism', description: 'Drag a part and observe', color: '#3D5AFE', icon: 'swap-horizontal' },
  flowSimulation: { label: 'Flow', description: 'Watch a process unfold', color: '#2ECC71', icon: 'play' },
};

const FALLBACK: ActivityTypeMeta = { label: 'Unknown', description: '', color: '#8892B0', icon: 'help-circle' };

export function getActivityTypeMeta(type: string): ActivityTypeMeta {
  return ACTIVITY_TYPES[type as ActivityType] ?? FALLBACK;
}

/**
 * Activity types with no "wrong answer" — explorables and every premium
 * engine type only ever call onComplete(true). Shared here so
 * ActivityRenderer (feedback text, hint visibility) and app/lesson/[id].tsx
 * (the "Explore" vs "Question" step label) agree on the same list instead
 * of each hand-maintaining it.
 */
export const NO_WRONG_ANSWER_TYPES: ReadonlySet<ActivityType> = new Set([
  'explorable',
  'interactiveSimulation',
  'interactiveDiagram',
  'parameterExperiment',
  'buildChallenge',
  'causeEffectExplorer',
  'systemBuilder',
  'physicsPlayground',
  'animatedProcess',
  'guidedDiscovery',
  'interactiveTimeline',
  'hotspotExplorer',
  'measurementTool',
  'dragMechanism',
  'flowSimulation',
  'predictionChallenge',
]);

export function isExploreType(type: ActivityType): boolean {
  return NO_WRONG_ANSWER_TYPES.has(type);
}
