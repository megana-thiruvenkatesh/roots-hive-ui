/** Step keys for Supplier 8D wizard (each is its own Next page). */
export const SUPPLIER_STEPS = [
  { key: 'step1', title: 'Step 1 : Issue Creation' },
  { key: 'step2', title: 'Step 2 : Problem Description' },
  { key: 'step3', title: 'Step 3 : Interim Containment Action' },
  { key: 'step4', title: 'Step 4 : ROOT CAUSE (WHY WHY ANALYSIS)' },
  { key: 'step4_1', title: 'Step 4.1 : Simulation Test & Mechanism of Occurrence (Optional)' },
  { key: 'step5', title: 'Step 5 : Corrective Action & Implementation' },
  { key: 'step6', title: 'Step 6 : STANDARDIZATION' },
  { key: 'step7_1', title: 'Step 7.1 : PREVENTIVE ACTION' },
  { key: 'step7_2', title: 'Step 7.2 : Effectiveness Monitoring' },
  { key: 'step8', title: 'Step 8 : Feedback & Closure' },
];

export const QA_NETWORK_OPTIONS = [
  'QSP',
  'FMEA',
  'CP',
  'DRG.',
  'WI',
  'WD',
  'FORMATS',
  'SUPPLIER DOCS.',
  'OTHER updations',
];

export const PROBABLE_CAUSES = ['Occurrence', 'Detection', 'Systemic', 'Other'];

export function emptyWizardSteps() {
  return {
    step1: {
      notificationNo: '',
      supplierCodeName: '',
      itemCodeName: '',
      dcNoDate: '',
      dateOfIssue: '',
      lotQty: '',
      problemQty: '',
      inspectedQty: '',
      problemRaisedBy: '',
      spnNumber: '',
      symptom: '',
      problemPhotoName: '',
      problem: '',
      spnType: '',
      okPartRefName: '',
      problemStatement: '',
      problemIdentifiedAt: '',
    },
    step2: {
      defectPartProducedOn: '',
      complaintReceivedOn: '',
      machineName: '',
      operatorName: '',
    },
    step3: {
      areaLocation: '',
      partsInspected: '',
      inspectionMethod: '',
      okQty: '',
      notOkQty: '',
      notes: '',
      containmentFileName: '',
    },
    step4: {
      rows: [
        { probableCause: 'Occurrence', why1: '', why2: '', why3: '', why4: '' },
        { probableCause: 'Detection', why1: '', why2: '', why3: '', why4: '' },
      ],
    },
    step4_1: {
      simulationTest: '',
      mechanismOfOccurrence: '',
    },
    step5: {
      actions: [
        {
          rootCause: '',
          occurrenceOutflow: 'Occurrence',
          correctiveAction: '',
          responsible: '',
          targetDate: '',
          fileName: '',
        },
      ],
      remarks: '',
      status: 'Open',
    },
    step6: {
      qaNetwork: [],
      verificationEvidence: '',
      attachmentName: '',
    },
    step7_1: {
      horizontalDeployment: 'No',
      applicableItem: '',
      responsibility: '',
      targetDate: '',
      implemented: '',
    },
    step7_2: {
      months: [
        { year: '', month: '', inspectedQty: '', rejectionQty: '', reworkQty: '' },
        { year: '', month: '', inspectedQty: '', rejectionQty: '', reworkQty: '' },
        { year: '', month: '', inspectedQty: '', rejectionQty: '', reworkQty: '' },
      ],
    },
    step8: {
      status: 'Open',
    },
  };
}

export function defaultWizardData() {
  return {
    currentStep: 0,
    maxReached: 0,
    steps: emptyWizardSteps(),
  };
}

export function mergeWizardData(saved) {
  const base = defaultWizardData();
  if (!saved || typeof saved !== 'object') return base;
  const steps = emptyWizardSteps();
  for (const key of Object.keys(steps)) {
    if (saved.steps?.[key]) {
      steps[key] = { ...steps[key], ...saved.steps[key] };
      if (key === 'step4' && Array.isArray(saved.steps.step4?.rows)) {
        steps.step4.rows = saved.steps.step4.rows;
      }
      if (key === 'step5' && Array.isArray(saved.steps.step5?.actions)) {
        steps.step5.actions = saved.steps.step5.actions;
      }
      if (key === 'step7_2' && Array.isArray(saved.steps.step7_2?.months)) {
        steps.step7_2.months = saved.steps.step7_2.months;
      }
      if (key === 'step6' && Array.isArray(saved.steps.step6?.qaNetwork)) {
        steps.step6.qaNetwork = saved.steps.step6.qaNetwork;
      }
    }
  }
  return {
    currentStep: Number.isFinite(saved.currentStep) ? saved.currentStep : 0,
    maxReached: Number.isFinite(saved.maxReached) ? saved.maxReached : 0,
    steps,
  };
}

/** Map step1 fields onto top-level complaint columns for list/search. */
export function complaintFieldsFromStep1(s1) {
  const item = (s1.itemCodeName || '').trim();
  let partCode = '';
  let part = item;
  const amp = item.indexOf('&');
  if (amp > -1) {
    partCode = item.slice(0, amp).trim();
    part = item.slice(amp + 1).trim() || partCode;
  }
  return {
    type: 'Supplier',
    customer: s1.supplierCodeName || null,
    part: part || null,
    partCode: partCode || null,
    defectCat: s1.symptom || null,
    desc: s1.problemStatement || s1.problem || s1.symptom || 'Supplier complaint',
    lotQty: s1.lotQty === '' ? null : Number(s1.lotQty),
    defectQty: s1.problemQty === '' ? null : Number(s1.problemQty),
    raisedDate: s1.dateOfIssue || undefined,
    process: s1.problemIdentifiedAt || null,
  };
}
