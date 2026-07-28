export type ActivityType =
  | 'multipleChoice'
  | 'tapCorrect'
  | 'fillBlank'
  | 'dragOrder'
  | 'matchPairs'
  | 'numberLine'
  | 'trueFalse'
  | 'writing'
  | 'explorable'
  | 'interactiveSimulation'
  | 'interactiveDiagram'
  | 'parameterExperiment'
  | 'buildChallenge'
  | 'causeEffectExplorer'
  | 'systemBuilder'
  | 'physicsPlayground'
  | 'animatedProcess'
  | 'guidedDiscovery'
  | 'predictionChallenge'
  | 'interactiveTimeline'
  | 'hotspotExplorer'
  | 'measurementTool'
  | 'dragMechanism'
  | 'flowSimulation';

export interface MatchPair {
  left: string;
  right: string;
}

/**
 * A threshold-triggered callout for an interactive explorable — the message
 * shown once the slider crosses `at` (0-100), replaced by the next
 * threshold's message as the user keeps dragging. Mirrors Brilliant.org's
 * "drag to see what happens" explorables: manipulate a variable, read live
 * feedback, no single "correct" answer — the exercise IS the exploration.
 */
export interface ExplorableThreshold {
  at: number;
  message: string;
}

export type ExplorableScene = 'toilet' | 'waterTower' | 'fridge' | 'helicopter' | 'contamination';

export interface ExplorableConfig {
  scene: ExplorableScene;
  sliderLabel: string;
  thresholds: ExplorableThreshold[];
  /** slider value (0-100) the user must reach at least once before "Got it" unlocks. Default 85. */
  completionThreshold?: number;
}

/*
 * ---------------------------------------------------------------------
 * Premium interactive activity engine — config types.
 *
 * These are subject-agnostic building blocks: a Physics lesson wires in
 * float valves and refrigerant pressure, a future Biology lesson could wire
 * in the exact same shapes with heart-rate/blood-oxygen parameters. Nothing
 * below references any specific domain. Each config type corresponds to one
 * reusable component under components/engine/ (see that folder's README
 * comment in ActivityRenderer.tsx for the full kind -> component mapping).
 * ---------------------------------------------------------------------
 */

/** A draggable numeric input driving a simulation (slider or dial). */
export interface SimulationParameter {
  id: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  defaultValue?: number;
  color?: string;
}

export type ReadoutKind = 'gauge' | 'thermometer';

/**
 * A live readout derived from a parameter's current value via a plain
 * linear mapping (fromMin/fromMax -> toMin/toMax, optionally inverted).
 * Kept declarative (no embedded functions) so data/learningData.ts stays
 * pure, serializable curriculum data — consistent with every other config
 * in this file (ExplorableConfig, etc). Linear mapping is enough to model
 * "pressure rises with tower height" or "fridge inside temp falls as
 * compressor speed rises" without needing arbitrary code in content data.
 */
export interface SimulationReadout {
  id: string;
  kind: ReadoutKind;
  label: string;
  unit?: string;
  sourceParameterId: string;
  /** value range of the readout itself, e.g. temperature -10..40 */
  toMin: number;
  toMax: number;
  /** true = as the source parameter rises, this readout falls */
  invert?: boolean;
  color: string;
}

/**
 * Drag one or more parameters, watch live readouts react. Powers
 * `parameterExperiment`, and is reused (via components/engine/InteractiveSimulation.tsx
 * and MeasurementTool.tsx aliases) for `interactiveSimulation`, `physicsPlayground`,
 * and `measurementTool` — those three names describe the same interaction
 * shape (drag a variable, observe a live measurement) so they share one
 * battle-tested component instead of three near-duplicate implementations.
 */
export interface ParameterExperimentConfig {
  parameters: SimulationParameter[];
  readouts: SimulationReadout[];
  /** scene key resolved to a renderer in components/engine's scene registry. */
  sceneKey?: string;
  /** narration key resolved to a narration-text function in the same registry. */
  narrateKey?: string;
  goalParameterId?: string;
  goalThresholdPct?: number;
}

export interface CameraShot {
  /** 1 = fully zoomed out (whole scene). Larger = zoomed in. */
  scale: number;
  /** 0-100, the point in the scene the camera centers on horizontally. */
  focusX: number;
  /** 0-100, the point in the scene the camera centers on vertically. */
  focusY: number;
}

export interface CauseEffectStage {
  id: string;
  /** short stage name shown in the stage tracker, e.g. "Siphon Starts" */
  title: string;
  /** explanation revealed once this stage's transition finishes and playback auto-pauses */
  caption: string;
  /** the underlying 0-100 scene-progress value this stage animates TO (stage 0's value is the resting start state) */
  toValue: number;
  /** ms for the transition into this stage at 1x speed — deliberately slow, this is a museum-exhibit pace, not realism */
  durationMs: number;
  /** where the camera pans/zooms to while this stage plays and while it's paused afterward */
  camera: CameraShot;
}

/**
 * A guided, camera-directed, stage-by-stage simulation: the student steps
 * through named stages (Play/Pause/Restart/Step Forward/Step Back/speed),
 * each stage animates the scene toward its `toValue` at a deliberately slow
 * pace, the camera pans/zooms to `camera` for that stage, and playback
 * always auto-pauses at the end of a stage so the student reads the
 * caption before continuing — nothing auto-advances through multiple
 * stages unattended. Powers `causeEffectExplorer`, and is reused (via
 * components/engine/CauseEffectExplorer.tsx) for `animatedProcess`,
 * `interactiveTimeline`, and `flowSimulation` — all four names describe
 * the same "staged, camera-directed process" interaction, so a future
 * Biology cell-division or Chemistry reaction lesson reuses this exact
 * component with its own stages/camera shots/scene.
 */
export interface CauseEffectExplorerConfig {
  stages: CauseEffectStage[];
  /** scene key resolved to a renderer in components/engine's scene registry. */
  sceneKey: string;
  /** world-space size the scene is laid out in, used by the camera to compute pan/zoom. */
  sceneWidth: number;
  sceneHeight: number;
  completionLabel?: string;
}

/** A part available to place in a build/repair challenge. */
export interface BuildPart {
  id: string;
  label: string;
  icon?: string;
  required: boolean;
}

/**
 * Select the minimal correct set of parts to solve a goal. Powers
 * `buildChallenge`, and is reused (via components/engine/SystemBuilder.tsx)
 * for `systemBuilder` — assembling a system from parts is the same
 * interaction as repairing something from parts.
 */
export interface BuildChallengeConfig {
  prompt: string;
  parts: BuildPart[];
  successMessage: string;
  failureMessage: string;
}

export interface DiscoveryFact {
  id: string;
  icon?: string;
  title: string;
  detail: string;
}

/**
 * A short sequence of tap-to-reveal facts — used both as a bite-sized
 * "small explanation" bridge between activities and as a lesson's closing
 * "real world application" step. Powers `guidedDiscovery`.
 */
export interface GuidedDiscoveryConfig {
  intro: string;
  facts: DiscoveryFact[];
}

/** A labelled, positioned part in a diagram (0-100 coordinate space). */
export interface DiagramHotspot {
  id: string;
  label: string;
  x: number; // 0-100
  y: number; // 0-100
  icon?: string;
  detail: string;
}

/**
 * Tap labelled hotspots on a diagram to reveal what each part does. Powers
 * `hotspotExplorer`, and is reused (via components/engine/AnimatedDiagram
 * as its rendering surface) for `interactiveDiagram` — both names describe
 * "explore a labelled diagram by tapping its parts."
 */
export interface HotspotExplorerConfig {
  sceneKey: string;
  hotspots: DiagramHotspot[];
  /** fraction of hotspots (0-1) that must be viewed before completion unlocks. Default 1 (all). */
  requiredViewFraction?: number;
}

export interface PredictionOption {
  id: string;
  label: string;
}

/**
 * Predict-observe-explain: the learner commits to a guess before seeing the
 * simulated outcome, then the actual result is revealed with a short
 * explanation of why. Powers `predictionChallenge`.
 */
export interface PredictionChallengeConfig {
  prompt: string;
  options: PredictionOption[];
  correctOptionId: string;
  /** scene key rendered once the guess is locked in, showing the real outcome. */
  sceneKey?: string;
  explanation: string;
}

/**
 * Drag a single mechanical part along a track and observe the effect —
 * powers standalone `dragMechanism` activities (distinct from
 * ParameterExperiment's slider, this is a physical part with a spring-back
 * release for a "weighted" feel).
 */
export interface DragMechanismConfig {
  title: string;
  partIcon: string;
  minLabel: string;
  maxLabel: string;
  describeKey: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  question: string;
  hint: string;
  options: string[];
  correctAnswer: string;
  difficulty: 1 | 2 | 3;
  pairs?: MatchPair[];
  min?: number;
  max?: number;
  explorableConfig?: ExplorableConfig;
  parameterExperimentConfig?: ParameterExperimentConfig;
  causeEffectConfig?: CauseEffectExplorerConfig;
  buildChallengeConfig?: BuildChallengeConfig;
  guidedDiscoveryConfig?: GuidedDiscoveryConfig;
  hotspotConfig?: HotspotExplorerConfig;
  predictionConfig?: PredictionChallengeConfig;
  dragMechanismConfig?: DragMechanismConfig;
}

export interface Lesson {
  id: string;
  title: string;
  objective: string;
  explanation: string;
  activities: Activity[];
  xp: number;
  badgeName: string;
  badgeIcon: string;
  prerequisiteLessonId?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  color: string;
  iconName: string;
  order: number;
  lessons: Lesson[];
}

export interface Subject {
  id: 'math' | 'english' | 'physics';
  title: string;
  color: string;
  iconName: string;
  topics: Topic[];
}

const mathCounting: Topic = {
  id: 'counting', title: 'Counting', order: 1,
  description: 'Count objects and understand number order.',
  color: '#3B82F6', iconName: 'calculator',
  lessons: [
    {
      id: 'cnt_1', title: 'Count to 5', xp: 50,
      badgeName: 'Counter Starter', badgeIcon: '⭐',
      objective: 'Count objects from 1 to 5.',
      explanation: 'To count, point to each object and say one number. 1… 2… 3… 4… 5!',
      activities: [
        { id: 'cnt1_a1', type: 'tapCorrect', difficulty: 1,
          question: 'How many apples? 🍎🍎🍎',
          hint: 'Count each apple one by one.',
          options: ['1', '2', '3', '4'], correctAnswer: '3' },
        { id: 'cnt1_a2', type: 'tapCorrect', difficulty: 1,
          question: 'How many stars? ⭐⭐⭐⭐⭐',
          hint: 'Touch each star as you count.',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
        { id: 'cnt1_a3', type: 'multipleChoice', difficulty: 1,
          question: 'What number comes after 3?',
          hint: '1, 2, 3, ___',
          options: ['2', '4', '5', '6'], correctAnswer: '4' },
        { id: 'cnt1_a4', type: 'multipleChoice', difficulty: 1,
          question: 'Which group shows 2?',
          hint: 'Count the dots in each group.',
          options: ['●', '●●', '●●●', '●●●●'], correctAnswer: '●●' },
        { id: 'cnt1_a5', type: 'trueFalse', difficulty: 1,
          question: '3 is the same as three.',
          hint: 'The number 3 is written as "three" in words.',
          options: ['True', 'False'], correctAnswer: 'True' },
      ],
    },
    {
      id: 'cnt_2', title: 'Count to 10', xp: 55,
      prerequisiteLessonId: 'cnt_1',
      badgeName: 'Number Tracker', badgeIcon: '🔟',
      objective: 'Count and place numbers from 1 to 10.',
      explanation: 'After 5 comes 6, 7, 8, 9, 10. Use a number line to find where numbers live.',
      activities: [
        { id: 'cnt2_a1', type: 'numberLine', difficulty: 2,
          question: 'Find the number 6 on the number line.',
          hint: 'Start from 1 and count forward.',
          options: ['6'], correctAnswer: '6', min: 1, max: 10 },
        { id: 'cnt2_a2', type: 'fillBlank', difficulty: 2,
          question: '4, 5, ___, 7, 8',
          hint: 'One more than 5 is…',
          options: ['5', '6', '7', '8'], correctAnswer: '6' },
        { id: 'cnt2_a3', type: 'numberLine', difficulty: 2,
          question: 'Show me where 9 lives.',
          hint: 'Count: 1, 2, 3… all the way to 9.',
          options: ['9'], correctAnswer: '9', min: 1, max: 10 },
        { id: 'cnt2_a4', type: 'multipleChoice', difficulty: 2,
          question: 'Count: ● ● ● ● ● ● ● ●',
          hint: 'Count the dots carefully.',
          options: ['6', '7', '8', '9'], correctAnswer: '8' },
      ],
    },
    {
      id: 'cnt_3', title: 'Number Order Challenge', xp: 60,
      prerequisiteLessonId: 'cnt_2',
      badgeName: 'Order Master', badgeIcon: '🏆',
      objective: 'Put numbers in the correct order.',
      explanation: 'Numbers always follow a pattern: each one is one more than the last.',
      activities: [
        { id: 'cnt3_a1', type: 'dragOrder', difficulty: 3,
          question: 'Put these numbers in order from smallest to largest.',
          hint: 'Which number is smallest? Start there.',
          options: ['3', '1', '4', '2', '5'], correctAnswer: '1,2,3,4,5' },
        { id: 'cnt3_a2', type: 'fillBlank', difficulty: 3,
          question: '___, 7, 8, 9, 10',
          hint: 'One less than 7 is…',
          options: ['4', '5', '6', '8'], correctAnswer: '6' },
        { id: 'cnt3_a3', type: 'dragOrder', difficulty: 3,
          question: 'Order these: 10, 6, 8, 7, 9',
          hint: 'Find the smallest number first.',
          options: ['10', '6', '8', '7', '9'], correctAnswer: '6,7,8,9,10' },
        { id: 'cnt3_a4', type: 'multipleChoice', difficulty: 3,
          question: 'Which list is in order from 1 to 5?',
          hint: 'Each number should be one more than the last.',
          options: ['3,1,2,4,5', '1,2,3,4,5', '2,3,1,4,5', '5,4,3,2,1'], correctAnswer: '1,2,3,4,5' },
      ],
    },
  ],
};

const mathAddition: Topic = {
  id: 'addition', title: 'Addition', order: 2,
  description: 'Learn to add numbers together.',
  color: '#10B981', iconName: 'add-circle',
  lessons: [
    {
      id: 'add_1', title: 'Adding to 5', xp: 50,
      badgeName: 'Sum Starter', badgeIcon: '➕',
      objective: 'Add two numbers to get a total up to 5.',
      explanation: 'Adding means putting groups together. 2 apples + 1 apple = 3 apples.',
      activities: [
        { id: 'add1_a1', type: 'multipleChoice', difficulty: 1,
          question: '2 + 1 = ?',
          hint: 'Count on from 2: 2… 3.',
          options: ['2', '3', '4', '5'], correctAnswer: '3' },
        { id: 'add1_a2', type: 'tapCorrect', difficulty: 1,
          question: '🍎🍎 + 🍎🍎🍎 = ?',
          hint: 'Count all the apples together.',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
        { id: 'add1_a3', type: 'numberLine', difficulty: 1,
          question: 'Start at 2, jump forward 2. Where do you land?',
          hint: 'Put your finger on 2, then hop 2 more.',
          options: ['4'], correctAnswer: '4', min: 0, max: 8 },
        { id: 'add1_a4', type: 'multipleChoice', difficulty: 1,
          question: '1 + 4 = ?',
          hint: 'Count on from 4: 4… 5.',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
      ],
    },
    {
      id: 'add_2', title: 'Adding to 10', xp: 55,
      prerequisiteLessonId: 'add_1',
      badgeName: 'Plus Power', badgeIcon: '💪',
      objective: 'Add numbers with sums up to 10.',
      explanation: 'Use the number line — start at the bigger number and jump forward.',
      activities: [
        { id: 'add2_a1', type: 'multipleChoice', difficulty: 2,
          question: '6 + 2 = ?',
          hint: 'Start at 6, count 2 more.',
          options: ['6', '7', '8', '9'], correctAnswer: '8' },
        { id: 'add2_a2', type: 'fillBlank', difficulty: 2,
          question: '3 + ___ = 7',
          hint: 'How many more do you need to get from 3 to 7?',
          options: ['2', '3', '4', '5'], correctAnswer: '4' },
        { id: 'add2_a3', type: 'numberLine', difficulty: 2,
          question: 'Start at 4, add 5. Where do you land?',
          hint: 'Jump 5 steps forward from 4.',
          options: ['9'], correctAnswer: '9', min: 0, max: 10 },
        { id: 'add2_a4', type: 'fillBlank', difficulty: 2,
          question: '___ + 5 = 10',
          hint: 'What number added to 5 makes 10?',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
      ],
    },
    {
      id: 'add_3', title: 'Addition Stories', xp: 65,
      prerequisiteLessonId: 'add_2',
      badgeName: 'Story Solver', badgeIcon: '📖',
      objective: 'Solve addition problems in real-life stories.',
      explanation: 'Read the story, find the two numbers, and add them.',
      activities: [
        { id: 'add3_a1', type: 'fillBlank', difficulty: 3,
          question: 'Sara has 4 pencils. She gets 3 more. She has ___ pencils.',
          hint: '4 + 3 = ?',
          options: ['5', '6', '7', '8'], correctAnswer: '7' },
        { id: 'add3_a2', type: 'multipleChoice', difficulty: 3,
          question: '5 birds sat on a branch. 3 more joined. How many birds now?',
          hint: '5 + 3 = ?',
          options: ['6', '7', '8', '9'], correctAnswer: '8' },
        { id: 'add3_a3', type: 'fillBlank', difficulty: 3,
          question: 'Ben read 2 books on Monday and 4 on Tuesday. He read ___ books total.',
          hint: '2 + 4 = ?',
          options: ['4', '5', '6', '7'], correctAnswer: '6' },
        { id: 'add3_a4', type: 'multipleChoice', difficulty: 3,
          question: 'A box has 4 apples. Another box has 6. Together they have how many?',
          hint: '4 + 6 = ?',
          options: ['8', '9', '10', '11'], correctAnswer: '10' },
      ],
    },
  ],
};

const mathSubtraction: Topic = {
  id: 'subtraction', title: 'Subtraction', order: 3,
  description: 'Learn to take away and find the difference.',
  color: '#F59E0B', iconName: 'remove-circle',
  lessons: [
    {
      id: 'sub_1', title: 'Taking Away', xp: 50,
      badgeName: 'Minus Starter', badgeIcon: '➖',
      objective: 'Subtract small numbers by taking away.',
      explanation: 'Subtraction means taking some away. 5 apples take away 2 = 3 apples.',
      activities: [
        { id: 'sub1_a1', type: 'tapCorrect', difficulty: 1,
          question: '5 - 2 = ?',
          hint: 'Start at 5 and count back 2.',
          options: ['2', '3', '4', '5'], correctAnswer: '3' },
        { id: 'sub1_a2', type: 'multipleChoice', difficulty: 1,
          question: '4 - 1 = ?',
          hint: 'Take one away from 4.',
          options: ['1', '2', '3', '4'], correctAnswer: '3' },
        { id: 'sub1_a3', type: 'tapCorrect', difficulty: 1,
          question: '7 - 3 = ?',
          hint: 'Count back 3 steps from 7.',
          options: ['3', '4', '5', '6'], correctAnswer: '4' },
        { id: 'sub1_a4', type: 'multipleChoice', difficulty: 1,
          question: '6 - 2 = ?',
          hint: '6 take away 2.',
          options: ['2', '3', '4', '5'], correctAnswer: '4' },
      ],
    },
    {
      id: 'sub_2', title: 'Subtract Within 10', xp: 55,
      prerequisiteLessonId: 'sub_1',
      badgeName: 'Difference Finder', badgeIcon: '🔍',
      objective: 'Subtract numbers with answers up to 10.',
      explanation: 'Use a number line — start at the bigger number and hop backwards.',
      activities: [
        { id: 'sub2_a1', type: 'multipleChoice', difficulty: 2,
          question: '9 - 4 = ?',
          hint: 'Count back 4 from 9.',
          options: ['4', '5', '6', '7'], correctAnswer: '5' },
        { id: 'sub2_a2', type: 'fillBlank', difficulty: 2,
          question: '8 - ___ = 5',
          hint: 'What do you subtract from 8 to get 5?',
          options: ['1', '2', '3', '4'], correctAnswer: '3' },
        { id: 'sub2_a3', type: 'multipleChoice', difficulty: 2,
          question: '10 - 6 = ?',
          hint: 'Start at 10, count back 6.',
          options: ['3', '4', '5', '6'], correctAnswer: '4' },
        { id: 'sub2_a4', type: 'fillBlank', difficulty: 2,
          question: '___ - 4 = 3',
          hint: 'If you have 3 left after taking 4, you started with…',
          options: ['5', '6', '7', '8'], correctAnswer: '7' },
      ],
    },
    {
      id: 'sub_3', title: 'Subtraction Stories', xp: 65,
      prerequisiteLessonId: 'sub_2',
      badgeName: 'Take Away Champ', badgeIcon: '🏅',
      objective: 'Solve subtraction word problems.',
      explanation: 'Find the "start" and "how many taken away" in the story, then subtract.',
      activities: [
        { id: 'sub3_a1', type: 'fillBlank', difficulty: 3,
          question: 'Lily had 8 cookies. She ate 3. She has ___ left.',
          hint: '8 - 3 = ?',
          options: ['4', '5', '6', '7'], correctAnswer: '5' },
        { id: 'sub3_a2', type: 'multipleChoice', difficulty: 3,
          question: 'A tree had 10 apples. 4 fell down. How many are left?',
          hint: '10 - 4 = ?',
          options: ['5', '6', '7', '8'], correctAnswer: '6' },
        { id: 'sub3_a3', type: 'fillBlank', difficulty: 3,
          question: 'Jake had 9 stickers. He gave ___ away and has 6 left.',
          hint: '9 - 6 = ?',
          options: ['1', '2', '3', '4'], correctAnswer: '3' },
        { id: 'sub3_a4', type: 'multipleChoice', difficulty: 3,
          question: 'You have 7 balloons. 2 fly away. How many remain?',
          hint: '7 - 2 = ?',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
      ],
    },
  ],
};

const mathShapes: Topic = {
  id: 'shapes', title: 'Shapes', order: 4,
  description: 'Discover 2D shapes and their properties.',
  color: '#8B5CF6', iconName: 'shapes',
  lessons: [
    {
      id: 'shp_1', title: 'Meet the Shapes', xp: 50,
      badgeName: 'Shape Spotter', badgeIcon: '🔷',
      objective: 'Name common 2D shapes and recognise them.',
      explanation: 'Shapes have sides and corners. A triangle has 3 sides. A square has 4 equal sides.',
      activities: [
        { id: 'shp1_a1', type: 'matchPairs', difficulty: 1,
          question: 'Match each shape to its number of sides.',
          hint: 'Count the sides of each shape.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'Triangle', right: '3 sides' },
            { left: 'Square', right: '4 sides' },
            { left: 'Pentagon', right: '5 sides' },
            { left: 'Circle', right: '0 sides' },
          ] },
        { id: 'shp1_a2', type: 'multipleChoice', difficulty: 1,
          question: 'Which shape has 4 equal sides?',
          hint: 'All 4 sides are the same length.',
          options: ['Rectangle', 'Square', 'Triangle', 'Circle'], correctAnswer: 'Square' },
        { id: 'shp1_a3', type: 'tapCorrect', difficulty: 1,
          question: 'Which shape has NO corners?',
          hint: 'It is perfectly round.',
          options: ['Triangle', 'Square', 'Rectangle', 'Circle'], correctAnswer: 'Circle' },
        { id: 'shp1_a4', type: 'matchPairs', difficulty: 1,
          question: 'Match the symbol to its shape name.',
          hint: 'Count the sides of each symbol.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: '▲', right: 'Triangle' },
            { left: '■', right: 'Square' },
            { left: '▬', right: 'Rectangle' },
            { left: '●', right: 'Circle' },
          ] },
      ],
    },
    {
      id: 'shp_2', title: 'Count Sides & Corners', xp: 55,
      prerequisiteLessonId: 'shp_1',
      badgeName: 'Corner Counter', badgeIcon: '📐',
      objective: 'Count the sides and corners of shapes.',
      explanation: 'A corner is where two sides meet. A triangle has 3 corners, a square has 4.',
      activities: [
        { id: 'shp2_a1', type: 'multipleChoice', difficulty: 2,
          question: 'How many corners does a triangle have?',
          hint: 'Count where the sides meet.',
          options: ['2', '3', '4', '5'], correctAnswer: '3' },
        { id: 'shp2_a2', type: 'fillBlank', difficulty: 2,
          question: 'A rectangle has ___ sides.',
          hint: 'It has 2 long sides and 2 short sides.',
          options: ['2', '3', '4', '5'], correctAnswer: '4' },
        { id: 'shp2_a3', type: 'multipleChoice', difficulty: 2,
          question: 'Which shape has 6 sides?',
          hint: 'Hexa = 6 in Greek.',
          options: ['Pentagon', 'Hexagon', 'Square', 'Octagon'], correctAnswer: 'Hexagon' },
        { id: 'shp2_a4', type: 'fillBlank', difficulty: 2,
          question: 'A pentagon has ___ corners.',
          hint: 'Same number as its sides.',
          options: ['3', '4', '5', '6'], correctAnswer: '5' },
      ],
    },
    {
      id: 'shp_3', title: 'Shape Challenge', xp: 65,
      prerequisiteLessonId: 'shp_2',
      badgeName: 'Geometry Star', badgeIcon: '🌟',
      objective: 'Order shapes and solve shape puzzles.',
      explanation: 'Now we mix counting sides with ordering shapes — you\'re a shape expert!',
      activities: [
        { id: 'shp3_a1', type: 'dragOrder', difficulty: 3,
          question: 'Order shapes from FEWEST to MOST sides.',
          hint: 'Count sides: Triangle=3, Square=4, Pentagon=5, Hexagon=6.',
          options: ['Hexagon', 'Triangle', 'Square', 'Pentagon'],
          correctAnswer: 'Triangle,Square,Pentagon,Hexagon' },
        { id: 'shp3_a2', type: 'multipleChoice', difficulty: 3,
          question: 'Which shape has the MOST sides?',
          hint: 'Octa = 8 in Greek.',
          options: ['Triangle', 'Square', 'Hexagon', 'Octagon'], correctAnswer: 'Octagon' },
        { id: 'shp3_a3', type: 'fillBlank', difficulty: 3,
          question: 'An octagon has ___ sides.',
          hint: 'Think of an octopus — how many legs?',
          options: ['6', '7', '8', '9'], correctAnswer: '8' },
        { id: 'shp3_a4', type: 'multipleChoice', difficulty: 3,
          question: 'I have 4 sides but am NOT a square. What am I?',
          hint: 'My two pairs of sides are different lengths.',
          options: ['Circle', 'Triangle', 'Rectangle', 'Pentagon'], correctAnswer: 'Rectangle' },
      ],
    },
  ],
};

const englishAlphabet: Topic = {
  id: 'alphabet', title: 'Alphabet', order: 1,
  description: 'Learn all 26 letters in order.',
  color: '#EF4444', iconName: 'text',
  lessons: [
    {
      id: 'abc_1', title: 'Letters A to F', xp: 50,
      badgeName: 'ABC Starter', badgeIcon: '🔤',
      objective: 'Recognise the first 6 letters of the alphabet.',
      explanation: 'The alphabet starts: A, B, C, D, E, F. Each letter has an uppercase and a lowercase form.',
      activities: [
        { id: 'abc1_a1', type: 'multipleChoice', difficulty: 1,
          question: 'Which letter comes after C?',
          hint: 'A, B, C, ___',
          options: ['A', 'B', 'D', 'E'], correctAnswer: 'D' },
        { id: 'abc1_a2', type: 'matchPairs', difficulty: 1,
          question: 'Match each letter to the word it starts.',
          hint: 'Say each word aloud.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'A', right: 'Apple' },
            { left: 'B', right: 'Ball' },
            { left: 'C', right: 'Cat' },
            { left: 'D', right: 'Dog' },
          ] },
        { id: 'abc1_a3', type: 'tapCorrect', difficulty: 1,
          question: 'Which letter comes before F?',
          hint: '…C, D, E, F',
          options: ['C', 'D', 'E', 'G'], correctAnswer: 'E' },
        { id: 'abc1_a4', type: 'multipleChoice', difficulty: 1,
          question: 'What is the FIRST letter of the alphabet?',
          hint: 'It starts the word "apple".',
          options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      ],
    },
    {
      id: 'abc_2', title: 'Letters G to M', xp: 55,
      prerequisiteLessonId: 'abc_1',
      badgeName: 'Letter Explorer', badgeIcon: '🔠',
      objective: 'Recognise letters G through M.',
      explanation: 'G, H, I, J, K, L, M — the middle of the alphabet. Practice saying them in order!',
      activities: [
        { id: 'abc2_a1', type: 'fillBlank', difficulty: 2,
          question: 'H, I, ___, K',
          hint: 'What letter sits between I and K?',
          options: ['G', 'J', 'L', 'M'], correctAnswer: 'J' },
        { id: 'abc2_a2', type: 'matchPairs', difficulty: 2,
          question: 'Match each letter to the word it starts.',
          hint: 'Think of objects that begin with each letter.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'G', right: 'Grape' },
            { left: 'H', right: 'Hat' },
            { left: 'I', right: 'Ice cream' },
            { left: 'J', right: 'Jar' },
          ] },
        { id: 'abc2_a3', type: 'fillBlank', difficulty: 2,
          question: '___, H, I',
          hint: 'One letter before H.',
          options: ['F', 'G', 'J', 'K'], correctAnswer: 'G' },
        { id: 'abc2_a4', type: 'tapCorrect', difficulty: 2,
          question: 'Which letter comes after L?',
          hint: '…J, K, L, ___',
          options: ['J', 'K', 'M', 'N'], correctAnswer: 'M' },
      ],
    },
    {
      id: 'abc_3', title: 'Alphabet Order Challenge', xp: 65,
      prerequisiteLessonId: 'abc_2',
      badgeName: 'Alphabet Champion', badgeIcon: '🏆',
      objective: 'Arrange letters in alphabetical order.',
      explanation: 'Putting letters in ABC order is called alphabetical order. A always comes before B, B before C, and so on.',
      activities: [
        { id: 'abc3_a1', type: 'dragOrder', difficulty: 3,
          question: 'Put these letters in alphabetical order.',
          hint: 'Which letter comes first in the alphabet?',
          options: ['D', 'B', 'E', 'A', 'C'], correctAnswer: 'A,B,C,D,E' },
        { id: 'abc3_a2', type: 'multipleChoice', difficulty: 3,
          question: 'Which list is in ABC order?',
          hint: 'Check if each letter is after the one before it.',
          options: ['C, A, B', 'A, B, C', 'B, A, C', 'C, B, A'], correctAnswer: 'A, B, C' },
        { id: 'abc3_a3', type: 'dragOrder', difficulty: 3,
          question: 'Arrange these letters in order.',
          hint: 'Think: J comes before K, before L, before M.',
          options: ['M', 'J', 'L', 'K'], correctAnswer: 'J,K,L,M' },
        { id: 'abc3_a4', type: 'fillBlank', difficulty: 3,
          question: 'W, X, ___, Z',
          hint: 'Almost the end of the alphabet!',
          options: ['U', 'V', 'Y', 'Q'], correctAnswer: 'Y' },
      ],
    },
  ],
};

const englishPhonics: Topic = {
  id: 'phonics', title: 'Phonics', order: 2,
  description: 'Learn letter sounds and how to blend them.',
  color: '#EC4899', iconName: 'volume-high',
  lessons: [
    {
      id: 'pho_1', title: 'Short Vowel Sounds', xp: 50,
      badgeName: 'Vowel Finder', badgeIcon: '🔊',
      objective: 'Identify the 5 short vowel sounds: a, e, i, o, u.',
      explanation: 'Vowels are A, E, I, O, U. Short vowel sounds: /a/ as in "cat", /e/ as in "bed", /i/ as in "pig", /o/ as in "hot", /u/ as in "cup".',
      activities: [
        { id: 'pho1_a1', type: 'tapCorrect', difficulty: 1,
          question: 'Which word has the short /a/ sound?',
          hint: '/a/ sounds like the "a" in "cat".',
          options: ['cake', 'cat', 'late', 'hay'], correctAnswer: 'cat' },
        { id: 'pho1_a2', type: 'multipleChoice', difficulty: 1,
          question: 'What vowel sound is in the word "pig"?',
          hint: 'Say "pig" slowly: p-i-g.',
          options: ['/a/', '/e/', '/i/', '/o/'], correctAnswer: '/i/' },
        { id: 'pho1_a3', type: 'tapCorrect', difficulty: 1,
          question: 'Which word has the short /e/ sound?',
          hint: '/e/ sounds like the "e" in "bed".',
          options: ['feet', 'bead', 'bed', 'bee'], correctAnswer: 'bed' },
        { id: 'pho1_a4', type: 'multipleChoice', difficulty: 1,
          question: 'Which vowel is in the word "hot"?',
          hint: 'Say "hot" slowly: h-o-t.',
          options: ['a', 'e', 'i', 'o'], correctAnswer: 'o' },
      ],
    },
    {
      id: 'pho_2', title: 'Letter Sounds', xp: 55,
      prerequisiteLessonId: 'pho_1',
      badgeName: 'Sound Matcher', badgeIcon: '🎵',
      objective: 'Match letters to the sounds they make.',
      explanation: 'Every letter makes a special sound. S says /s/, M says /m/, T says /t/, P says /p/.',
      activities: [
        { id: 'pho2_a1', type: 'matchPairs', difficulty: 2,
          question: 'Match each letter to its sound.',
          hint: 'Say the letter sound out loud.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'S', right: '/s/ as in sun' },
            { left: 'M', right: '/m/ as in moon' },
            { left: 'T', right: '/t/ as in top' },
            { left: 'P', right: '/p/ as in pan' },
          ] },
        { id: 'pho2_a2', type: 'fillBlank', difficulty: 2,
          question: 'The word "bat" starts with the letter ___.',
          hint: '/b/ is the first sound in "bat".',
          options: ['a', 'b', 'c', 'd'], correctAnswer: 'b' },
        { id: 'pho2_a3', type: 'matchPairs', difficulty: 2,
          question: 'Match each letter to a word that starts with its sound.',
          hint: 'Say each word — what is the first sound?',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'F', right: 'Fish' },
            { left: 'G', right: 'Gate' },
            { left: 'H', right: 'Hand' },
            { left: 'J', right: 'Jump' },
          ] },
        { id: 'pho2_a4', type: 'tapCorrect', difficulty: 2,
          question: 'What sound does "c" make in the word "cat"?',
          hint: '"Cat" starts with a hard /k/ sound.',
          options: ['/s/', '/k/', '/ch/', '/sh/'], correctAnswer: '/k/' },
      ],
    },
    {
      id: 'pho_3', title: 'Blend & Read', xp: 65,
      prerequisiteLessonId: 'pho_2',
      badgeName: 'Blending Pro', badgeIcon: '🌟',
      objective: 'Blend letter sounds to read simple words.',
      explanation: 'Blending means saying each sound then joining them: /c/ /a/ /t/ → "cat".',
      activities: [
        { id: 'pho3_a1', type: 'fillBlank', difficulty: 3,
          question: 'bl + ue = ___',
          hint: 'Say each part: /bl/ then /ue/.',
          options: ['blue', 'blew', 'blow', 'bloe'], correctAnswer: 'blue' },
        { id: 'pho3_a2', type: 'dragOrder', difficulty: 3,
          question: 'Put the sounds in order to make the word "cat".',
          hint: 'Start with the first sound you hear.',
          options: ['/t/', '/a/', '/c/'], correctAnswer: '/c/,/a/,/t/' },
        { id: 'pho3_a3', type: 'fillBlank', difficulty: 3,
          question: 'str + ___ + ng = "strong"',
          hint: 'What vowel sits in the middle?',
          options: ['a', 'e', 'i', 'o'], correctAnswer: 'o' },
        { id: 'pho3_a4', type: 'tapCorrect', difficulty: 3,
          question: 'Which word is made from: /sh/ + /ip/?',
          hint: 'Blend the two sounds together.',
          options: ['sip', 'ship', 'shop', 'chip'], correctAnswer: 'ship' },
      ],
    },
  ],
};

const englishVocabulary: Topic = {
  id: 'vocabulary', title: 'Vocabulary', order: 3,
  description: 'Build your word bank with fun topics.',
  color: '#06B6D4', iconName: 'book',
  lessons: [
    {
      id: 'voc_1', title: 'Colours & Opposites', xp: 50,
      badgeName: 'Word Collector', badgeIcon: '📚',
      objective: 'Name colours and understand opposite words.',
      explanation: 'Opposites are words with completely different meanings: hot ↔ cold, big ↔ small.',
      activities: [
        { id: 'voc1_a1', type: 'matchPairs', difficulty: 1,
          question: 'Match each colour word to what it describes.',
          hint: 'Think of something that colour.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'Red', right: '🍎 apple' },
            { left: 'Blue', right: '🌊 ocean' },
            { left: 'Green', right: '🌿 leaf' },
            { left: 'Yellow', right: '🌟 star' },
          ] },
        { id: 'voc1_a2', type: 'tapCorrect', difficulty: 1,
          question: 'Which word describes the sky on a sunny day?',
          hint: 'Look up on a clear day.',
          options: ['rough', 'blue', 'heavy', 'loud'], correctAnswer: 'blue' },
        { id: 'voc1_a3', type: 'multipleChoice', difficulty: 1,
          question: 'What word means "very big"?',
          hint: 'It is the opposite of tiny.',
          options: ['tiny', 'small', 'huge', 'thin'], correctAnswer: 'huge' },
        { id: 'voc1_a4', type: 'matchPairs', difficulty: 1,
          question: 'Match each word to its opposite.',
          hint: 'Opposites are words with completely different meanings.',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'Hot', right: 'Cold' },
            { left: 'Big', right: 'Small' },
            { left: 'Fast', right: 'Slow' },
            { left: 'Happy', right: 'Sad' },
          ] },
        { id: 'voc1_a5', type: 'writing', difficulty: 1,
          question: 'Spell the word for a colour that is like the sky.',
          hint: 'It starts with the letter B.',
          options: ['Blue', 'Blu', 'Blew', 'Bluo'], correctAnswer: 'Blue' },
      ],
    },
    {
      id: 'voc_2', title: 'Animals & Their Homes', xp: 55,
      prerequisiteLessonId: 'voc_1',
      badgeName: 'Animal Talker', badgeIcon: '🐾',
      objective: 'Name animals and where they live.',
      explanation: 'Animals live in special homes: birds live in nests, fish live in the ocean, bears live in caves.',
      activities: [
        { id: 'voc2_a1', type: 'multipleChoice', difficulty: 2,
          question: 'A baby dog is called a ___.',
          hint: 'It rhymes with "cuppy".',
          options: ['kitten', 'foal', 'cub', 'puppy'], correctAnswer: 'puppy' },
        { id: 'voc2_a2', type: 'tapCorrect', difficulty: 2,
          question: 'Which animal can fly?',
          hint: 'It has wings and feathers.',
          options: ['cat', 'fish', 'bird', 'frog'], correctAnswer: 'bird' },
        { id: 'voc2_a3', type: 'fillBlank', difficulty: 2,
          question: 'The lion is called the king of the ___.',
          hint: 'A wild, hot, dense forest area.',
          options: ['sea', 'forest', 'jungle', 'sky'], correctAnswer: 'jungle' },
        { id: 'voc2_a4', type: 'matchPairs', difficulty: 2,
          question: 'Match each animal to its home.',
          hint: 'Where does each animal sleep or live?',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'Bird', right: 'Nest' },
            { left: 'Fish', right: 'Ocean' },
            { left: 'Bear', right: 'Cave' },
            { left: 'Bee', right: 'Hive' },
          ] },
      ],
    },
    {
      id: 'voc_3', title: 'Vocabulary Challenge', xp: 65,
      prerequisiteLessonId: 'voc_2',
      badgeName: 'Word Master', badgeIcon: '🎓',
      objective: 'Use vocabulary in context and order by meaning.',
      explanation: 'Great vocabulary means picking the best word for each situation.',
      activities: [
        { id: 'voc3_a1', type: 'fillBlank', difficulty: 3,
          question: 'I am ___ because I got a gift.',
          hint: 'Getting a gift feels good.',
          options: ['happy', 'unhappy', 'angry', 'scared'], correctAnswer: 'happy' },
        { id: 'voc3_a2', type: 'dragOrder', difficulty: 3,
          question: 'Order these animals from SMALLEST to LARGEST.',
          hint: 'Think about how big each animal is in real life.',
          options: ['elephant', 'ant', 'dog', 'cat'],
          correctAnswer: 'ant,cat,dog,elephant' },
        { id: 'voc3_a3', type: 'multipleChoice', difficulty: 3,
          question: 'What is the opposite of "ancient" (very old)?',
          hint: 'Ancient means very, very old. The opposite is…',
          options: ['old', 'huge', 'modern', 'quiet'], correctAnswer: 'modern' },
        { id: 'voc3_a4', type: 'fillBlank', difficulty: 3,
          question: 'She ran ___ to catch the bus.',
          hint: 'If you\'re late, you must run quickly.',
          options: ['fast', 'slow', 'quietly', 'loud'], correctAnswer: 'fast' },
      ],
    },
  ],
};

const englishGrammar: Topic = {
  id: 'grammar', title: 'Grammar', order: 4,
  description: 'Learn nouns, verbs, and how to build sentences.',
  color: '#14B8A6', iconName: 'create',
  lessons: [
    {
      id: 'grm_1', title: 'Nouns — Naming Words', xp: 50,
      badgeName: 'Noun Spotter', badgeIcon: '🔍',
      objective: 'Identify nouns (people, places, things, times).',
      explanation: 'A noun is a naming word. "Dog", "school", "Emma", and "Monday" are all nouns.',
      activities: [
        { id: 'grm1_a1', type: 'tapCorrect', difficulty: 1,
          question: 'Which word is a noun (a naming word)?',
          hint: 'A noun names a person, place, or thing.',
          options: ['run', 'happy', 'dog', 'quickly'], correctAnswer: 'dog' },
        { id: 'grm1_a2', type: 'multipleChoice', difficulty: 1,
          question: 'Which of these is NOT a noun?',
          hint: 'One of these is an action, not a name.',
          options: ['school', 'book', 'jump', 'teacher'], correctAnswer: 'jump' },
        { id: 'grm1_a3', type: 'tapCorrect', difficulty: 1,
          question: 'Find the noun: "The big red car drove fast."',
          hint: 'What is the thing being described?',
          options: ['big', 'red', 'car', 'fast'], correctAnswer: 'car' },
        { id: 'grm1_a4', type: 'matchPairs', difficulty: 1,
          question: 'Match each noun to its category.',
          hint: 'Is it a person, a place, or a thing?',
          options: [], correctAnswer: 'matched',
          pairs: [
            { left: 'London', right: 'Place' },
            { left: 'Emma', right: 'Person' },
            { left: 'Chair', right: 'Thing' },
            { left: 'Tuesday', right: 'Time' },
          ] },
      ],
    },
    {
      id: 'grm_2', title: 'Verbs — Action Words', xp: 55,
      prerequisiteLessonId: 'grm_1',
      badgeName: 'Action Hero', badgeIcon: '⚡',
      objective: 'Identify verbs (action words) in sentences.',
      explanation: 'A verb is an action word: run, jump, eat, sleep. Every sentence needs a verb!',
      activities: [
        { id: 'grm2_a1', type: 'multipleChoice', difficulty: 2,
          question: 'Which word is a verb (action word)?',
          hint: 'Which word describes something you DO?',
          options: ['table', 'happy', 'run', 'tree'], correctAnswer: 'run' },
        { id: 'grm2_a2', type: 'fillBlank', difficulty: 2,
          question: 'She ___ to school every day.',
          hint: 'One person + present tense needs "walks" not "walk".',
          options: ['walk', 'walks', 'walking', 'walked'], correctAnswer: 'walks' },
        { id: 'grm2_a3', type: 'tapCorrect', difficulty: 2,
          question: 'Find the verb: "The dog barked loudly."',
          hint: 'What did the dog DO?',
          options: ['dog', 'barked', 'loudly', 'the'], correctAnswer: 'barked' },
        { id: 'grm2_a4', type: 'fillBlank', difficulty: 2,
          question: 'Yesterday, I ___ a book.',
          hint: '"Yesterday" means it already happened — past tense.',
          options: ['read', 'reads', 'reading', 'readed'], correctAnswer: 'read' },
      ],
    },
    {
      id: 'grm_3', title: 'Build a Sentence', xp: 65,
      prerequisiteLessonId: 'grm_2',
      badgeName: 'Sentence Builder', badgeIcon: '🏗️',
      objective: 'Put words in the correct order to build sentences.',
      explanation: 'English sentences usually go: Subject → Verb → Object. "The dog plays ball."',
      activities: [
        { id: 'grm3_a1', type: 'dragOrder', difficulty: 3,
          question: 'Build a sentence from these words.',
          hint: 'Who does the action? Then what is the action?',
          options: ['plays', 'The', 'ball', 'dog'],
          correctAnswer: 'The,dog,plays,ball' },
        { id: 'grm3_a2', type: 'dragOrder', difficulty: 3,
          question: 'Arrange these words into a sentence.',
          hint: 'Start with the person doing the action.',
          options: ['book', 'reads', 'She', 'a'],
          correctAnswer: 'She,reads,a,book' },
        { id: 'grm3_a3', type: 'fillBlank', difficulty: 3,
          question: '___ is the capital city of England.',
          hint: 'Big red buses and the River Thames.',
          options: ['Paris', 'London', 'Berlin', 'Madrid'], correctAnswer: 'London' },
        { id: 'grm3_a4', type: 'multipleChoice', difficulty: 3,
          question: 'Which sentence is correct?',
          hint: 'Capital letter at start, full stop at end, verb agrees with subject.',
          options: ['The cat sleep.', 'The cats sleeps.', 'The cat sleeps.', 'Cat the sleeps.'],
          correctAnswer: 'The cat sleeps.' },
      ],
    },
  ],
};

const householdPhysics: Topic = {
  id: 'household-physics', title: 'Household Physics', order: 1,
  description: 'Drag, explore, and discover the physics hiding in everyday objects.',
  color: '#22D3EE', iconName: 'flask',
  lessons: [
    {
      id: 'phy_1', title: 'Toilets', xp: 110,
      badgeName: 'Siphon Scientist', badgeIcon: '🚽',
      objective: 'Discover how gravity, pressure, and a siphon work together to flush a toilet — then repair one yourself.',
      explanation: 'A toilet bowl always keeps some water in it, sealed by a bent pipe called a trap. Pushing the handle lifts a flapper and lets tank water rush into the bowl. Once enough water piles over the bend in the trap, the whole pipe fills up and starts acting like a straw — sucking the water (and whatever is in the bowl) down and away. That sudden "straw" effect is called a siphon. A second mechanism, the float valve, uses gravity and buoyancy to know exactly when to stop refilling the tank — conserving water instead of overflowing it.',
      activities: [
        // --- Interactive Discovery: flush the toilet, watch the siphon fire ---
        {
          id: 'phy1_flush', type: 'causeEffectExplorer', difficulty: 2,
          question: 'Step through the flush, one stage at a time. Watch where the water actually goes.',
          hint: 'Use Step Forward to advance one stage at a time, or Play to watch continuously — you can Step Back or Restart any time.',
          options: [], correctAnswer: 'explored',
          causeEffectConfig: {
            sceneKey: 'toiletCutaway',
            sceneWidth: 340,
            sceneHeight: 400,
            completionLabel: 'I understand the siphon!',
            stages: [
              { id: 's0', title: 'Tank Full', toValue: 0, durationMs: 600,
                camera: { scale: 1, focusX: 50, focusY: 48 },
                caption: 'At rest, gravity holds the tank full above and a resting pool of water sealed in the bowl below — that seal is what stops sewer gas from rising back into the room.' },
              { id: 's1', title: 'Handle Pressed', toValue: 9, durationMs: 900,
                camera: { scale: 1.9, focusX: 27, focusY: 31 },
                caption: 'Pressing the handle lifts the flush valve at the bottom of the tank.' },
              { id: 's2', title: 'Valve Opens', toValue: 20, durationMs: 1400,
                camera: { scale: 1.9, focusX: 27, focusY: 31 },
                caption: 'The flush valve is fully open now. With nothing holding it back, gravity pulls the tank\'s water straight down into the bowl.' },
              { id: 's3', title: 'Water Falls', toValue: 40, durationMs: 1800,
                camera: { scale: 1.6, focusX: 44, focusY: 52 },
                caption: 'Watch the bowl — water pours in and the level climbs steadily upward, pushed by gravity alone.' },
              { id: 's4', title: 'Pressure Changes', toValue: 48, durationMs: 1400,
                camera: { scale: 2.1, focusX: 58, focusY: 52 },
                caption: 'The water has reached the top of the trapway\'s rising leg. As it spills over, pressure inside that narrow pipe starts to build.' },
              { id: 's5', title: 'Siphon Starts', toValue: 60, durationMs: 2000,
                camera: { scale: 2.4, focusX: 60, focusY: 53 },
                caption: 'SIPHON! The rising leg of the trapway is now completely full of water, so the whole pipe suddenly acts like a bent straw — pulling water through continuously instead of just trickling over the top.' },
              { id: 's6', title: 'Rapid Bowl Evacuation', toValue: 75, durationMs: 1400,
                camera: { scale: 1.7, focusX: 63, focusY: 66 },
                caption: 'With the siphon running, the bowl empties in a rush — everything gets pulled down the trapway and out through the outlet pipe.' },
              { id: 's7', title: 'Tank Refill', toValue: 88, durationMs: 2200,
                camera: { scale: 1.9, focusX: 47, focusY: 15 },
                caption: 'Air finally breaks the siphon, the flush valve drops shut, and the float valve lets fresh water start refilling the tank.' },
              { id: 's8', title: 'Float Valve Closes', toValue: 100, durationMs: 1400,
                camera: { scale: 1.9, focusX: 47, focusY: 15 },
                caption: 'As the tank refills, the float rises with the water. Once it reaches the top, it seals the float valve completely — using gravity and buoyancy alone to stop the water exactly on time.' },
            ],
          },
        },
        // --- Small Explanation, tap-to-reveal (bridges discovery -> simulation) ---
        {
          id: 'phy1_facts', type: 'guidedDiscovery', difficulty: 1,
          question: 'Two forces are doing all the work here. Tap each card to find out what they are.',
          hint: '',
          options: [], correctAnswer: 'explored',
          guidedDiscoveryConfig: {
            intro: 'Before you experiment with the float valve, meet the two physics ideas behind every flush.',
            facts: [
              { id: 'f1', icon: 'arrow-down', title: 'Gravity', detail: 'Gravity pulls tank water down into the bowl, and pulls bowl water down through the trap — no pump needed anywhere in the system.' },
              { id: 'f2', icon: 'water', title: 'Pressure & the siphon', detail: 'Once the trap pipe is completely full, the weight of water on the long side creates enough pressure to pull everything through — that continuous pull is the siphon effect.' },
            ],
          },
        },
        // --- Simulation: drag the float valve, watch the tank respond ---
        {
          id: 'phy1_float_drag', type: 'dragMechanism', difficulty: 2,
          question: 'Drag the float up and down and feel how it controls the water level.',
          hint: 'A low float means an empty tank; a high float means a full one.',
          options: [], correctAnswer: 'explored',
          dragMechanismConfig: {
            title: 'The Float Valve',
            partIcon: 'water',
            minLabel: 'Empty tank',
            maxLabel: 'Full tank',
            describeKey: 'floatValve',
          },
        },
        // --- Experiment: parameter + live gauges (refill speed, pressure) ---
        {
          id: 'phy1_experiment', type: 'parameterExperiment', difficulty: 3,
          question: 'Raise the float higher and watch what happens to refill speed and water pressure.',
          hint: 'As the float rises, the valve closes — less water is flowing, so both readings should fall.',
          options: [], correctAnswer: 'explored',
          parameterExperimentConfig: {
            sceneKey: 'toiletTank',
            narrateKey: 'floatValveExperiment',
            parameters: [
              { id: 'floatHeight', label: 'Float height', unit: '%', min: 0, max: 100, defaultValue: 10, color: '#22D3EE' },
            ],
            readouts: [
              { id: 'refillSpeed', kind: 'gauge', label: 'Refill Speed', sourceParameterId: 'floatHeight', toMin: 0, toMax: 100, invert: true, color: '#3D5AFE' },
              { id: 'pressure', kind: 'gauge', label: 'Valve Pressure', sourceParameterId: 'floatHeight', toMin: 0, toMax: 100, invert: true, color: '#22D3EE' },
            ],
            goalParameterId: 'floatHeight',
            goalThresholdPct: 90,
          },
        },
        // --- Challenge: repair the leaking toilet with the fewest parts ---
        {
          id: 'phy1_repair', type: 'buildChallenge', difficulty: 3,
          question: 'This toilet keeps running non-stop, wasting water. Pick only the parts you actually need to fix it.',
          hint: 'A running toilet is almost always a worn flapper not sealing, or a float set too high.',
          options: [], correctAnswer: 'repaired',
          buildChallengeConfig: {
            prompt: 'Select the parts required to repair a toilet that keeps running. Choosing extra unnecessary parts will fail the repair — real plumbers fix it with the fewest parts possible.',
            parts: [
              { id: 'flapper', label: 'New Flapper', icon: 'ellipse', required: true },
              { id: 'float', label: 'Float Valve', icon: 'water', required: true },
              { id: 'newBowl', label: 'Entire New Bowl', icon: 'cube', required: false },
              { id: 'newTank', label: 'Entire New Tank', icon: 'cube-outline', required: false },
              { id: 'chain', label: 'Flapper Chain', icon: 'link', required: false },
            ],
            successMessage: 'Fixed it! A worn flapper and a mis-set float valve were the only real problems — no need to replace anything else.',
            failureMessage: 'Not quite — that combination either misses a required part or replaces something that was already working fine.',
          },
        },
        // --- Knowledge Check: existing activity types, unchanged ---
        { id: 'phy1_a2', type: 'trueFalse', difficulty: 1,
          question: 'The bent pipe (trap) under a toilet bowl is there to stop sewer smells from coming back up.',
          hint: 'Think about what keeps water sitting in the bowl at all times.',
          options: ['True', 'False'], correctAnswer: 'True' },
        { id: 'phy1_a3', type: 'multipleChoice', difficulty: 2,
          question: 'What actually pulls the water and waste out of the bowl during a flush?',
          hint: 'It happens once water fills the whole bent pipe.',
          options: ['The flapper falling', 'A siphon effect', 'The tank refilling', 'Water pressure from the tap'],
          correctAnswer: 'A siphon effect' },
        { id: 'phy1_a4', type: 'fillBlank', difficulty: 2,
          question: 'A siphon starts once water completely fills the ___ pipe, making it act like a straw.',
          hint: 'It\'s the bent pipe under the bowl that always holds some water.',
          options: ['trap', 'tank', 'handle', 'valve'], correctAnswer: 'trap' },
        { id: 'phy1_a5', type: 'multipleChoice', difficulty: 2,
          question: 'What does the float valve control?',
          hint: 'Think about what you just dragged in the simulation.',
          options: ['When the toilet flushes', 'How much water refills the tank', 'The color of the water', 'The bowl temperature'],
          correctAnswer: 'How much water refills the tank' },
        // --- Real World Application: guided discovery closing the lesson ---
        {
          id: 'phy1_real_world', type: 'guidedDiscovery', difficulty: 1,
          question: 'This exact float-valve idea shows up far beyond your bathroom. Tap each card.',
          hint: '',
          options: [], correctAnswer: 'explored',
          guidedDiscoveryConfig: {
            intro: 'The float valve is one of the simplest, most widely copied water-conservation inventions ever made.',
            facts: [
              { id: 'r1', icon: 'car', title: 'Carburetors', detail: 'Old car engines used the exact same float-valve idea to control fuel level in the carburetor bowl.' },
              { id: 'r2', icon: 'leaf', title: 'Water Conservation', detail: 'Modern low-flow toilets use precisely tuned float valves and flapper timing to use up to 80% less water per flush than older models.' },
              { id: 'r3', icon: 'business', title: 'Water Towers (next lesson!)', detail: 'The same gravity + float-valve principles scale up to control levels in giant municipal water towers.' },
            ],
          },
        },
      ],
    },
    {
      id: 'phy_2', title: 'Water Towers', xp: 70,
      prerequisiteLessonId: 'phy_1',
      badgeName: 'Pressure Pro', badgeIcon: '🗼',
      objective: 'See how height creates water pressure without any pumps.',
      explanation: 'Water towers store water high above the ground. Gravity pulls that water down through the pipes, and the taller the tower, the harder gravity pushes — creating more pressure. That\'s why a full tank up high can supply water to an entire neighbourhood all day, using almost no extra energy: the height itself does the work.',
      activities: [
        {
          id: 'phy2_explore', type: 'explorable', difficulty: 2,
          question: 'Raise the water tower and watch what happens to the water pressure below.',
          hint: 'Keep raising it — taller towers push water out harder and farther.',
          options: [], correctAnswer: 'explored',
          explorableConfig: {
            scene: 'waterTower',
            sliderLabel: 'Raise the tower\'s height',
            completionThreshold: 90,
            thresholds: [
              { at: 0, message: 'This tower is barely off the ground. Water needs pressure to travel through pipes — right now there\'s almost none.' },
              { at: 30, message: 'As the tower gets taller, gravity pulls the water down through the pipes harder, building up pressure.' },
              { at: 55, message: 'Now there\'s enough pressure to reach taps on the top floor of a tall building!' },
              { at: 80, message: 'Tall enough! This is why real water towers are built so high — one full tank can supply a whole town using gravity alone.' },
              { at: 92, message: 'Maximum pressure — see how much farther and higher the water sprays now compared to when the tower was short?' },
            ],
          },
        },
        { id: 'phy2_a2', type: 'multipleChoice', difficulty: 2,
          question: 'Why are water towers built so tall?',
          hint: 'Think about what pulls water down through pipes.',
          options: ['To look impressive', 'Height creates water pressure', 'To collect rain', 'To keep water cold'],
          correctAnswer: 'Height creates water pressure' },
        { id: 'phy2_a3', type: 'trueFalse', difficulty: 1,
          question: 'A taller water tower produces LESS water pressure at the ground than a short one.',
          hint: 'Does gravity pull harder or softer from higher up?',
          options: ['True', 'False'], correctAnswer: 'False' },
        { id: 'phy2_a4', type: 'fillBlank', difficulty: 2,
          question: 'Water towers use ___ instead of constantly running pumps to push water through pipes.',
          hint: 'The force that pulls everything toward the ground.',
          options: ['gravity', 'electricity', 'wind', 'heat'], correctAnswer: 'gravity' },
      ],
    },
    {
      id: 'phy_3', title: 'Refrigerators', xp: 75,
      prerequisiteLessonId: 'phy_2',
      badgeName: 'Cool Engineer', badgeIcon: '🧊',
      objective: 'Learn that fridges move heat out instead of making cold.',
      explanation: 'A fridge doesn\'t create cold — it moves heat from the inside to the outside. A compressor squeezes a special coolant into a hot liquid, which releases heat through coils on the back of the fridge. That liquid then expands back into a cold gas inside the fridge, soaking up heat from your food. The cycle repeats, over and over, moving heat out one small trip at a time.',
      activities: [
        {
          id: 'phy3_explore', type: 'explorable', difficulty: 2,
          question: 'Turn up the compressor and watch heat get pumped out of the fridge.',
          hint: 'Watch both thermometers — one drops while the other rises.',
          options: [], correctAnswer: 'explored',
          explorableConfig: {
            scene: 'fridge',
            sliderLabel: 'Speed up the compressor',
            completionThreshold: 90,
            thresholds: [
              { at: 0, message: 'The compressor is off. Without it pumping coolant around, the fridge slowly warms up to room temperature.' },
              { at: 28, message: 'The compressor kicks on, squeezing coolant gas until it turns into a hot liquid — releasing heat through the coils on the back.' },
              { at: 55, message: 'That hot liquid cools and flows inside, where it suddenly expands back into a cold gas — this is what actually chills your food.' },
              { at: 78, message: 'Cycle complete: the cold gas soaks up heat from inside, gets pumped back to the compressor, and repeats. The fridge isn\'t making cold — it\'s moving heat OUT.' },
              { at: 92, message: 'Maximum cooling! Notice the inside gets colder while the coils on the back get warmer — that heat has to go somewhere.' },
            ],
          },
        },
        { id: 'phy3_a2', type: 'trueFalse', difficulty: 2,
          question: 'A fridge works by creating "cold" and pumping it inside.',
          hint: 'Which direction does the heat actually travel — in, or out?',
          options: ['True', 'False'], correctAnswer: 'False' },
        { id: 'phy3_a3', type: 'multipleChoice', difficulty: 2,
          question: 'What happens to the coils on the BACK of a fridge while it\'s running?',
          hint: 'That heat from inside has to go somewhere.',
          options: ['They get colder', 'They get warmer', 'Nothing changes', 'They freeze'],
          correctAnswer: 'They get warmer' },
        { id: 'phy3_a4', type: 'fillBlank', difficulty: 2,
          question: 'A refrigerator moves ___ from inside the fridge to the outside air.',
          hint: 'It is not "cold" being created — it is the opposite being removed.',
          options: ['heat', 'cold', 'water', 'air'], correctAnswer: 'heat' },
      ],
    },
    {
      id: 'phy_4', title: 'Helicopter Toy', xp: 75,
      prerequisiteLessonId: 'phy_3',
      badgeName: 'Lift Master', badgeIcon: '🚁',
      objective: 'Discover how spinning blades create enough lift to fly.',
      explanation: 'A helicopter\'s blades are angled like tiny wings. As they spin, they push air downward — and for every push, the air pushes back just as hard in the opposite direction (that\'s one of Newton\'s laws in action). Spin the blades fast enough, and that upward push, called lift, becomes stronger than gravity pulling the helicopter down. That\'s the moment it lifts off the ground.',
      activities: [
        {
          id: 'phy4_explore', type: 'explorable', difficulty: 2,
          question: 'Spin the rotor blades faster and watch the helicopter take off.',
          hint: 'The helicopter needs enough spin speed before lift beats gravity.',
          options: [], correctAnswer: 'explored',
          explorableConfig: {
            scene: 'helicopter',
            sliderLabel: 'Spin the rotor blades',
            completionThreshold: 90,
            thresholds: [
              { at: 0, message: 'The blades are still. Gravity is the only force acting on the helicopter — it stays firmly on the ground.' },
              { at: 32, message: 'Spinning faster now — the angled blades are pushing air downward, but not enough yet to lift the helicopter\'s weight.' },
              { at: 58, message: 'Getting close! The faster the blades spin, the more air they push down every second, and the harder that air pushes back up.' },
              { at: 78, message: 'LIFTOFF! Once the upward push (lift) beats the helicopter\'s weight, it rises. NASA\'s Mars helicopter, Ingenuity, uses this exact idea.' },
              { at: 92, message: 'Full speed — maximum lift. Real helicopters fly the same way, just with much bigger blades and engines.' },
            ],
          },
        },
        { id: 'phy4_a2', type: 'multipleChoice', difficulty: 2,
          question: 'What force do spinning helicopter blades create that fights against gravity?',
          hint: 'It is the upward push created by pushing air downward.',
          options: ['Lift', 'Drag', 'Friction', 'Magnetism'],
          correctAnswer: 'Lift' },
        { id: 'phy4_a3', type: 'trueFalse', difficulty: 1,
          question: 'A helicopter lifts off the moment its lift force is greater than its weight.',
          hint: 'Think about what "winning" the tug-of-war between forces would mean.',
          options: ['True', 'False'], correctAnswer: 'True' },
        { id: 'phy4_a4', type: 'fillBlank', difficulty: 2,
          question: 'Helicopter blades push air ___, and the air pushes back up on the blades.',
          hint: 'Which direction does the spinning blade force the air?',
          options: ['downward', 'upward', 'sideways', 'nowhere'], correctAnswer: 'downward' },
      ],
    },
    {
      id: 'phy_5', title: 'Water Contamination', xp: 80,
      prerequisiteLessonId: 'phy_4',
      badgeName: 'Filtration Expert', badgeIcon: '💧',
      objective: 'Explore how filter pore size determines what stays out of drinking water.',
      explanation: 'Water filters work like very fine strainers. A coarse filter only catches big things like leaves and sand. A finer filter can catch smaller debris, and a very fine one (like the membranes used in reverse osmosis) can even block bacteria and tiny dissolved particles. The finer the filter, the cleaner the water — but also the more it costs to build and run.',
      activities: [
        {
          id: 'phy5_explore', type: 'explorable', difficulty: 2,
          question: 'Make the filter finer and watch what gets blocked at each stage.',
          hint: 'Keep going finer — smaller and smaller things get stopped.',
          options: [], correctAnswer: 'explored',
          explorableConfig: {
            scene: 'contamination',
            sliderLabel: 'Make the filter finer',
            completionThreshold: 90,
            thresholds: [
              { at: 0, message: 'This filter has big gaps — like a kitchen strainer. It only stops large chunks like leaves and sand; everything else flows straight through.' },
              { at: 28, message: 'A finer mesh now blocks smaller debris too, but bacteria and viruses are far too tiny to be stopped by cloth or sand alone.' },
              { at: 52, message: 'This is roughly how a household carbon filter works — it removes chlorine taste, sediment, and some chemicals, but not everything.' },
              { at: 78, message: 'Very fine filtration (like reverse osmosis membranes) can block bacteria and even many dissolved salts — this is how ships turn seawater into drinking water.' },
              { at: 92, message: 'At this level almost nothing gets through except water molecules themselves — the water looks completely clear now.' },
            ],
          },
        },
        { id: 'phy5_a2', type: 'multipleChoice', difficulty: 3,
          question: 'Why can\'t a simple cloth or sand filter remove bacteria from water?',
          hint: 'Compare the size of bacteria to the size of the gaps in cloth or sand.',
          options: ['Bacteria are too small to be caught', 'Bacteria are magnetic', 'Bacteria float above water', 'Cloth repels bacteria'],
          correctAnswer: 'Bacteria are too small to be caught' },
        { id: 'phy5_a3', type: 'trueFalse', difficulty: 2,
          question: 'Water that looks clear is always guaranteed to be free of harmful bacteria.',
          hint: 'Can something be invisible to the eye but still present in the water?',
          options: ['True', 'False'], correctAnswer: 'False' },
        { id: 'phy5_a4', type: 'fillBlank', difficulty: 2,
          question: 'The finer a filter\'s pores, the ___ particles it can block from passing through.',
          hint: 'A finer mesh catches things that a coarse one would miss.',
          options: ['smaller', 'larger', 'heavier', 'faster'], correctAnswer: 'smaller' },
      ],
    },
  ],
};

export const MATH_SUBJECT: Subject = {
  id: 'math', title: 'Mathematics', color: '#3B82F6', iconName: 'calculator',
  topics: [mathCounting, mathAddition, mathSubtraction, mathShapes],
};

export const ENGLISH_SUBJECT: Subject = {
  id: 'english', title: 'English', color: '#EC4899', iconName: 'book',
  topics: [englishAlphabet, englishPhonics, englishVocabulary, englishGrammar],
};

export const PHYSICS_SUBJECT: Subject = {
  id: 'physics', title: 'Physics of the Everyday', color: '#22D3EE', iconName: 'flask',
  topics: [householdPhysics],
};

export const SUBJECTS: Subject[] = [MATH_SUBJECT, ENGLISH_SUBJECT, PHYSICS_SUBJECT];

export function getTopicById(topicId: string): Topic | undefined {
  for (const subject of SUBJECTS) {
    const topic = subject.topics.find(t => t.id === topicId);
    if (topic) return topic;
  }
  return undefined;
}

export function getLessonById(lessonId: string): Lesson | undefined {
  for (const subject of SUBJECTS) {
    for (const topic of subject.topics) {
      const lesson = topic.lessons.find(l => l.id === lessonId);
      if (lesson) return lesson;
    }
  }
  return undefined;
}

export function getSubjectForTopic(topicId: string): Subject | undefined {
  return SUBJECTS.find(s => s.topics.some(t => t.id === topicId));
}
