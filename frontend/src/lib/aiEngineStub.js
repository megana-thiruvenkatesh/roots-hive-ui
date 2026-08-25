/**
 * AI Engine pages — UI + local heuristic stubs.
 * Backend team will replace `runLocalHeuristic` with real API calls later.
 */

const DEFECTS = [
  'Leakage',
  'Porosity',
  'Crack',
  'Dimensional Deviation',
  'Surface Finish',
  'Shrinkage',
  'Machining Issue',
  'Material Defect',
  'Cold Shut',
  'Contamination',
];

const KB = {
  Leakage: {
    rootCauses: [
      { cause: 'Internal shrinkage porosity', rate: 92, action: 'Increase cooling / optimize solidification' },
      { cause: 'Thick die coating', rate: 88, action: 'Define cleaning frequency' },
      { cause: 'Inadequate venting', rate: 85, action: 'Add vent provision' },
    ],
    whys: [
      'Leak observed in casting',
      'Internal shrinkage present',
      'Solidification delayed',
      'Excess die coat applied',
      'Standard frequency not defined',
    ],
  },
  Porosity: {
    rootCauses: [
      { cause: 'Gas entrapment during pour', rate: 90, action: 'Improve gating / degassing' },
      { cause: 'Moisture in sand/mold', rate: 84, action: 'Control mold moisture' },
    ],
    whys: [
      'Porosity found in X-ray',
      'Gas trapped in cavity',
      'Inadequate venting path',
      'Pouring turbulence high',
      'Process window not locked',
    ],
  },
  Crack: {
    rootCauses: [
      { cause: 'Thermal stress at weld zone', rate: 91, action: 'Control heat input / post-weld cool' },
      { cause: 'Material brittleness', rate: 80, action: 'Verify material certs / heat treat' },
    ],
    whys: [
      'Crack near weld zone',
      'Residual stress high',
      'Cooling rate uneven',
      'Fixture constraint tight',
      'Weld procedure not updated',
    ],
  },
};

function pickKb(defect) {
  return KB[defect] || KB.Leakage;
}

export function defectOptions() {
  return DEFECTS;
}

export function predictRca({ defectCategory, complaintText }) {
  const kb = pickKb(defectCategory);
  return {
    mode: 'heuristic-stub', // replace with backend AI later
    defectCategory,
    summary:
      complaintText?.slice(0, 120) ||
      `Predicted root causes for ${defectCategory} based on historical KB patterns.`,
    predictions: kb.rootCauses.map((r, i) => ({
      rank: i + 1,
      rootCause: r.cause,
      confidence: r.rate,
      correctiveAction: r.action,
    })),
  };
}

export function generateWhyWhy({ defectCategory, rootCause, complaintText }) {
  const kb = pickKb(defectCategory);
  const whys = [...kb.whys];
  if (rootCause) whys[4] = `Control for: ${rootCause}`;
  return {
    mode: 'heuristic-stub',
    defectCategory,
    complaintText,
    steps: whys.map((text, i) => ({ why: i + 1, text })),
  };
}

export function suggestActions({ defectCategory, rootCause }) {
  const kb = pickKb(defectCategory);
  let rows = kb.rootCauses;
  if (rootCause) {
    const hit = rows.filter((r) => r.cause.toLowerCase().includes(rootCause.toLowerCase()));
    if (hit.length) rows = hit;
  }
  return {
    mode: 'heuristic-stub',
    rows: rows.map((r, i) => ({
      id: i + 1,
      rootCause: r.cause,
      suggestedAction: r.action,
      successRate: r.rate,
      occurrences: Math.max(2, 5 - i),
    })),
  };
}

export function smartDiagnosticQuestions(defectCategory) {
  const base = [
    `Where on the part is the ${defectCategory?.toLowerCase() || 'defect'} observed?`,
    'Is the issue intermittent or consistent across lots?',
    'Which process step first detects the defect?',
    'Any recent change in tooling, material, or parameters?',
  ];
  return base;
}
