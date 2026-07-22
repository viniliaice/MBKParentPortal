export type ActivityType =
  | 'multipleChoice'
  | 'tapCorrect'
  | 'fillBlank'
  | 'dragOrder'
  | 'matchPairs'
  | 'numberLine'
  | 'trueFalse'
  | 'writing';

export interface MatchPair {
  left: string;
  right: string;
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
  id: 'math' | 'english';
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

export const MATH_SUBJECT: Subject = {
  id: 'math', title: 'Mathematics', color: '#3B82F6', iconName: 'calculator',
  topics: [mathCounting, mathAddition, mathSubtraction, mathShapes],
};

export const ENGLISH_SUBJECT: Subject = {
  id: 'english', title: 'English', color: '#EC4899', iconName: 'book',
  topics: [englishAlphabet, englishPhonics, englishVocabulary, englishGrammar],
};

export const SUBJECTS: Subject[] = [MATH_SUBJECT, ENGLISH_SUBJECT];

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
