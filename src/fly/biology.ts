// Every number of the fly's senses, behaviour and body (docs/fly.md), each marked measured (a value a paper reports),
// estimated (worked out from reported values) or assumed (chosen by hand, with no fly data behind it), with its source.
// The brain's own parameters are Shiu et al.'s, in src/fly/brain.ts.
//
// The session that wrote this could not open the papers: the hosts were blocked. A source marked "quoted" is the paper's
// text as a web search quoted it; "secondary" is a value another work reports. Both are to be checked against the paper.

export type Kind = 'measured' | 'estimated' | 'assumed';
export type Fact = { value: number; unit: string; kind: Kind; what: string; source: string };

const fact = (value: number, unit: string, kind: Kind, what: string, source = ''): Fact => ({ value, unit, kind, what, source });
const mendes = 'Mendes et al. 2013, eLife 2:e00231, Fig. 2 (quoted)';
const cardJeb = 'Card and Dickinson 2008, J Exp Biol 211:341, Table 1, escape takeoffs (secondary: a copy of the table)';

export const biology = {
  // Size and scale.
  bodyLength: fact(2.5, 'mm', 'measured', 'Body length of an adult female', 'BioNumbers BNID 100750, citing Matheson 2008 (secondary)'),
  pxPerMm: fact(96 / 25.4, 'CSS px per mm', 'assumed', 'Real size: CSS has 96 px to the inch, which is a real inch only at 100% display scaling', 'CSS Values and Units, reference pixel'),

  // Walking.
  walkSpeed: fact(28, 'mm/s', 'measured', 'Most common walking speed', mendes),
  walkSpeedSlow: fact(10, 'mm/s', 'estimated', 'Slow walking; mean speeds per fly ranged 7.2 to 44.7 mm/s', mendes),
  walkSpeedPeak: fact(50, 'mm/s', 'measured', 'Brief peak speed; flies kept pace with a 40 mm/s belt and exceeded 50 mm/s instantaneously', 'Pratt et al. 2024, Curr Biol (quoted)'),
  stepPeriodMin: fact(60, 'ms', 'measured', 'Step period at speeds above about 30 mm/s, where it levels off', mendes),
  strideLength: fact(1.7, 'mm', 'estimated', 'Stride length: 28 mm/s at a step period near 60 ms; speed is set mostly by step frequency (Wosnitza et al. 2013)', mendes),
  walkBout: fact(4, 's', 'assumed', 'Mean length of a walking bout'),
  pause: fact(2, 's', 'assumed', 'Mean length of a pause between bouts'),
  wander: fact(60, 'deg/s', 'assumed', 'Random turning while walking (standard deviation of the turn rate)'),
  turnRateMax: fact(400, 'deg/s', 'assumed', 'Fastest turn on the ground'),
  edgeRange: fact(4, 'mm', 'assumed', 'Distance at which a wall or panel edge pulls the walking fly along it'),
  edgeLeave: fact(0.08, 'per s', 'assumed', 'Chance per second of leaving an edge it follows. Flies spend most of their time at an arena\'s boundary (Soibam et al. 2012, Brain and Behavior, quoted)'),

  // Escape.
  postureLead: fact(200, 'ms', 'measured', 'Postural adjustments begin about this long before takeoff and set the jump direction, away from the threat', 'Card and Dickinson 2008, Curr Biol 18:1300, abstract and Fig. 2 (quoted)'),
  modeThreshold: fact(7, 'ms', 'measured', 'Takeoff duration (first wing movement to leaving the ground) between short and long mode; the minimum between the two modes is 6.87 ms', 'von Reyn et al. 2014, Nat Neurosci 17:962, Fig. 1 (quoted)'),
  legExtension: fact(3.33, 'ms', 'measured', 'Leg extension of an escape takeoff (median)', cardJeb),
  wingToLeg: fact(1.0, 'ms', 'measured', 'Wing movement to leg extension in an escape takeoff (median)', cardJeb),
  wingRaise: fact(8, 'ms', 'assumed', 'Time the long mode\'s full wing raise takes; long-mode takeoffs last 7 ms or more (von Reyn et al. 2014)'),
  stimulusToLiftoff: fact(190.67, 'ms', 'measured', 'Looming onset to liftoff (median), for comparison with the fly\'s own reaction times', cardJeb),
  wingRaiseRate: fact(60, 'Hz', 'assumed', 'Mean rate of the six wing-raise neurons (DNp02, DNp04, DNp11, both sides); twice this, held, takes off without the giant fibre'),
  wingRaiseHold: fact(30, 'ms', 'assumed', 'Wing raise held this long above 2 × wingRaiseRate takes off in long mode without a giant-fibre spike (von Reyn et al. 2014: long mode can happen without it)'),
  jumpSpeed: fact(0.5, 'm/s', 'assumed', 'Speed at which the jump leaves the ground'),
  jumpAngle: fact(45, 'deg', 'assumed', 'Angle of the jump above the screen: up and away, so a fly jumping under a swat must clear the palm before the hand comes down to its height'),
  tumble: fact(150, 'ms', 'assumed', 'Tumbling after a short-mode takeoff; escapes rotate rapidly (Card and Dickinson 2008, J Exp Biol, abstract)'),
  tumbleRate: fact(1500, 'deg/s', 'assumed', 'Rotation while tumbling'),
  freeze: fact(1.5, 's', 'assumed', 'Freezing after a looming stimulus that brought no escape (Zacarias et al. 2018 report freezing to looming)'),
  habituation: fact(0.25, 'of the gain', 'assumed', 'Loss of looming gain for each weak looming stimulus that brought no escape; giant-fibre escape habituates (Engel and Wu 1996, J Neurosci, abstract), but no looming numbers were found'),
  habituationRecovery: fact(30, 's', 'assumed', 'Time constant of the looming gain\'s recovery'),

  // Flight.
  flightSpeed: fact(0.15, 'm/s', 'measured', 'Preferred free-flight speed', 'Fry et al. 2009, J Exp Biol 212:1120, citing Tammero and Dickinson 2002 (quoted)'),
  flightSpeedMax: fact(0.85, 'm/s', 'measured', 'Upper bound of flight speed', 'Marden, Wolf and Weber 1997, J Exp Biol 200:2747, abstract (quoted)'),
  escapeFlightSpeed: fact(0.4, 'm/s', 'assumed', 'Flight speed in the first second after an escape'),
  saccadeAngle: fact(90, 'deg', 'measured', 'Body turn of a flight saccade', 'Bender and Dickinson 2006, J Exp Biol 209:3170 (quoted)'),
  saccadeDuration: fact(70, 'ms', 'measured', 'Duration of a 90° flight saccade', 'Bender and Dickinson 2006, J Exp Biol 209:3170 (quoted)'),
  saccadeInterval: fact(0.8, 's', 'assumed', 'Mean time between spontaneous flight saccades'),
  wingbeat: fact(220, 'Hz', 'estimated', 'Wingbeat frequency in flight: 189 Hz hovering, 230 Hz at higher force, 261 to 277 Hz in takeoffs', 'Dickinson and Muijres 2016 review (secondary); Card and Dickinson 2008, J Exp Biol, Table 1 (secondary)'),
  flightTime: fact(3, 's', 'assumed', 'Mean flight before landing'),
  flightHeight: fact(40, 'mm', 'assumed', 'Height above the screen in cruising flight, for the shadow'),

  // The hand (the cursor) and other senses.
  handRadius: fact(40, 'mm', 'assumed', 'Radius of the hand the cursor stands for'),
  handHeight: fact(60, 'mm', 'assumed', 'Height of the hovering hand over the screen'),
  swatDescent: fact(80, 'ms', 'assumed', 'Time a swat takes from hovering height to the screen'),
  palm: fact(12, 'mm', 'assumed', 'Radius under the hand within which a swat squashes the fly'),
  blindZone: fact(30, 'deg', 'assumed', 'Width of the blind zone straight behind the fly'),
  binocular: fact(20, 'deg', 'assumed', 'Width of the field both eyes see, straight ahead'),
  visualDelay: fact(15, 'ms', 'assumed', 'Delay from the eye to the visual projection neurons: the photoreceptors, lamina, medulla and lobula the circuit leaves out'),
  receptiveField: fact(30, 'deg', 'assumed', 'Receptive field of a visual projection neuron: something of angular size θ drives the share 1 − cos((θ + field) / 2) of an eye\'s LC4, LPLC2, LC10a and LC16 neurons, the cap of the eye it covers'),
  sizeLow: fact(10, 'deg', 'assumed', 'Angular size at which LPLC2 input starts'),
  sizeHigh: fact(60, 'deg', 'assumed', 'Angular size at which LPLC2 input is full'),
  expansionGate: fact(40, 'deg/s', 'assumed', 'Expansion speed at which LPLC2 input is fully on; a still hand does not loom'),
  lc4Speed: fact(300, 'deg/s', 'assumed', 'Expansion speed at which LC4 input is full (LC4 encodes angular velocity, LPLC2 angular size: von Reyn et al. 2017)'),
  objectSize: fact(12, 'deg', 'assumed', 'Largest angular size LC10a takes as a small object'),
  objectMotion: fact(60, 'deg/s', 'assumed', 'Sideways angular speed of a small object for full LC10a input'),
  flowSpeed: fact(400, 'px/s', 'assumed', 'Speed of scrolled content for full HS or H2 input'),
  vibrationRange: fact(100, 'mm', 'assumed', 'Distance at which a key press or click is felt at half strength'),
  vibrationPulse: fact(40, 'ms', 'assumed', 'Time constant of the vibration input after a key press or click'),
  appearRange: fact(60, 'mm', 'assumed', 'Distance within which an element appearing or resizing looms'),
  appearNear: fact(4, 'mm', 'assumed', 'Distance at which an appearing element looms at half strength; escapes come only from one appearing next to the fly'),
  appearPulse: fact(100, 'ms', 'assumed', 'Time constant of the looming input after an element appears'),
  smellRange: fact(80, 'mm', 'assumed', 'Length over which a smell falls to a third'),
  contact: fact(1.5, 'mm', 'assumed', 'Distance from the food\'s edge at which legs and proboscis taste it'),
  dust: fact(2, 's', 'assumed', 'Time constant of the antennal input after the fly is dusted'),

  // Motor layer: what the output neurons' rates do.
  rateFilter: fact(50, 'ms', 'assumed', 'Time constant over which output neurons\' spikes are averaged into rates'),
  steerGain: fact(3, 'deg/s per Hz', 'assumed', 'Turn rate per Hz of left-minus-right steering neuron rate (DNa01 and DNa02 predict ipsiversive turns: Yang et al. 2024, Rayshubskiy et al. 2025, as cited by connectocopter)'),
  walkGain: fact(0.2, 'mm/s per Hz', 'assumed', 'Added forward speed per Hz of P9 (DNp09) rate'),
  backRate: fact(20, 'Hz', 'assumed', 'MDN rate at which the fly backs up (MDN drives backward walking: Bidaye et al. 2014)'),
  backSpeed: fact(8, 'mm/s', 'assumed', 'Backing-up speed'),
  groomRate: fact(8, 'Hz', 'assumed', 'DNg11 rate that starts grooming'),
  groomBout: fact(3, 's', 'assumed', 'Length of a grooming bout'),
  groomEvery: fact(60, 's', 'assumed', 'Mean time between grooming bouts nothing set off'),
  feedRate: fact(20, 'Hz', 'assumed', 'MN9 rate that extends the proboscis (connectocopter uses 15 Hz)'),
  hungerRise: fact(6, 'h', 'assumed', 'Time from fed to fully hungry'),
  meal: fact(60, 's', 'assumed', 'Feeding time that takes the fly from fully hungry to fed'),
  sugarFed: fact(0.4, 'of full', 'assumed', 'Sugar sensitivity of a fed fly, rising to full when hungry (hunger raises sugar sensitivity: Inagaki et al. 2012)'),
  turnToSmell: fact(90, 'deg/s', 'assumed', 'Turn rate towards a smell while the smell projection neurons fire; the fly is not shown where the smell is, it turns up the window\'s gradient'),
};
export type BiologyKey = keyof typeof biology;

// The foods: how strongly each tastes sweet or bitter and smells of fermentation (0 to 1), and its radius in mm.
// All assumed; banana and vinegar smell because fermenting fruit gives off what DM1 and VA2 detect (Semmelhack and Wang
// 2009 name DM1 and VA2 for vinegar attraction; not checked against the paper in this session).
export const foods = {
  sugar: { sugar: 1, bitter: 0, smell: 0, radius: 2 },
  banana: { sugar: 0.7, bitter: 0, smell: 0.6, radius: 3.5 },
  vinegar: { sugar: 0, bitter: 0, smell: 1, radius: 2.5 },
  bitter: { sugar: 0, bitter: 1, smell: 0, radius: 2 },
} as const;
export type FoodKind = keyof typeof foods;

// Real millimetres to CSS px at real size. The size multiplier scales the body and its hit area, never these.
export const mmToPx = (mm: number) => mm * biology.pxPerMm.value;
export const pxToMm = (px: number) => px / biology.pxPerMm.value;
export const deg = (d: number) => d * Math.PI / 180;
