/**
 * Build enriched historic Excel (original columns + RCA / Why-Why / CA / PA)
 * from supplier-30row file, then import as active historic dataset.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { importHistoricBuffer } = require('../src/services/historicDataset');

const SRC = 'c:/Users/Meganamani/Downloads/supplier-30row-final-dataset.xlsx';
const OUT_DIR = path.join(__dirname, '../data/historic');
const OUT_NAME = 'supplier-30row-with-rca-ca-pa.xlsx';
const OUT_PATH = path.join(OUT_DIR, OUT_NAME);
const DOWNLOADS_PATH = path.join('c:/Users/Meganamani/Downloads', OUT_NAME);

function seedFor(row) {
  const cat = String(row.defect_category || 'quality defect').trim() || 'quality defect';
  const part = String(row.item_name || row.item_code || 'part').trim();
  const problem = String(row.problem_statement || cat).trim().slice(0, 120);

  const templates = {
    'Dia Over Size': {
      severity: 'Major',
      process: 'Machining / Threading',
      root_cause: `Tool wear / incorrect offset caused ${cat} on ${part}.`,
      why_1: `Observed ${cat} against drawing specification.`,
      why_2: 'Cutting tool / insert condition drifted beyond process window.',
      why_3: 'Tool life / offset verification not enforced at set frequency.',
      why_4: 'Process control plan missing hard stop for diameter check.',
      why_5: 'Standard work for tool change & first-piece approval incomplete.',
      corrective_action: `Quarantine affected lot, rework/sort ${part}, reset tool offset, and re-verify first article.`,
      preventive_action: 'Add tool-life counter, first-piece diameter gate, and periodic offset audit in control plan.',
    },
    'loose burr': {
      severity: 'Major',
      process: 'Machining / Deburr',
      root_cause: `Deburr operation incomplete — residual burr on ${part}.`,
      why_1: 'Customer found loose / unremoved machining burr.',
      why_2: 'Deburr station skipped or incompletely performed.',
      why_3: 'No poka-yoke / visual standard at end of line.',
      why_4: 'Operator training / work instruction for burr removal weak.',
      why_5: 'Final inspection sampling did not cover burr critical zones.',
      corrective_action: 'Contain lot, 100% sort for burr, retrain operators, and re-inspect before ship.',
      preventive_action: 'Add deburr check fixture / visual board and include burr zones in outgoing QC checklist.',
    },
    'Operation Missing': {
      severity: 'Critical',
      process: 'Routing / Assembly',
      root_cause: `Process step skipped for ${part} due to routing / traveler gap.`,
      why_1: `Operation found missing on ${part}.`,
      why_2: 'Traveler / routing did not force completion gate.',
      why_3: 'Previous station released parts without confirmation.',
      why_4: 'No barcode / scan validation for mandatory ops.',
      why_5: 'Control plan did not define hard stop before packing.',
      corrective_action: 'Stop shipment, identify skipped-op lots, complete missing operation, and re-inspect.',
      preventive_action: 'Enforce scan-based operation completion and add missing-op check before FG release.',
    },
    'Nogo answering': {
      severity: 'Major',
      process: 'Inspection / Gauging',
      root_cause: 'NOGO gauge acceptance due to worn gauge or incorrect gauging method.',
      why_1: 'Part accepted though NOGO condition existed.',
      why_2: 'Gauge wear / calibration interval exceeded.',
      why_3: 'Inspection method not validated for this feature.',
      why_4: 'No gauge R&R / daily check board at station.',
      why_5: 'Incoming / in-process gauge control weak.',
      corrective_action: 'Quarantine lot, re-gauge with calibrated master, replace worn NOGO, and retrain inspectors.',
      preventive_action: 'Daily gauge check board, calibration recall system, and revised inspection WI.',
    },
    Offset: {
      severity: 'Major',
      process: 'Machining / Setup',
      root_cause: `Fixture / program offset incorrect for ${part}.`,
      why_1: `Dimensional offset observed on ${part}.`,
      why_2: 'Machine / fixture offset not verified after setup.',
      why_3: 'Setup checklist incomplete or not signed off.',
      why_4: 'No first-article CMM / gauge confirmation after changeover.',
      why_5: 'Standard setup recovery method not followed.',
      corrective_action: 'Hold lot, correct fixture/program offset, machine first article, and sort WIP.',
      preventive_action: 'Mandatory setup checklist with first-article approval before production release.',
    },
    'Groove Diameter UnderSize': {
      severity: 'Major',
      process: 'Machining / Turning',
      root_cause: 'Groove tool / insert wear causing undersize diameter.',
      why_1: 'Groove diameter measured under minimum limit.',
      why_2: 'Insert wear not detected in-process.',
      why_3: 'In-process check frequency insufficient for groove feature.',
      why_4: 'No SPC alarm for groove diameter trend.',
      why_5: 'Tool change criterion not linked to measured diameter.',
      corrective_action: 'Contain lot, replace groove insert, reset process, and 100% check critical groove.',
      preventive_action: 'Increase in-process groove checks and add tool-change trigger from SPC.',
    },
    'Line_Scattering mark': {
      severity: 'Minor',
      process: 'Finishing / Handling',
      root_cause: 'Handling / process contact causing scattering / line marks.',
      why_1: 'Line scattering marks found on finished surface.',
      why_2: 'Part contacted dirty / damaged fixture or conveyor.',
      why_3: 'Handling protection / tray condition not controlled.',
      why_4: 'Visual standard for mark acceptance unclear.',
      why_5: 'No periodic fixture / tray cleanliness audit.',
      corrective_action: 'Isolate marked parts, clean/replace contact surfaces, and re-inspect appearance.',
      preventive_action: 'Protective trays, fixture condition checklist, and clearer visual acceptance standard.',
    },
    Ovality: {
      severity: 'Major',
      process: 'Machining / Boring',
      root_cause: 'Clamping distortion or spindle runout causing ovality.',
      why_1: 'Ovality beyond drawing tolerance.',
      why_2: 'Uneven clamp force / worn jaws distorted part.',
      why_3: 'Fixture condition and clamp torque not verified.',
      why_4: 'No roundness check in first-article for this feature.',
      why_5: 'Preventive maintenance on fixture insufficient.',
      corrective_action: 'Hold lot, rework/sort oval parts, correct clamp setup, and verify roundness.',
      preventive_action: 'Clamp torque standard, fixture PM, and roundness check in FAI.',
    },
    unwash: {
      severity: 'Minor',
      process: 'Washing / Cleaning',
      root_cause: 'Wash process ineffective — residue left on part.',
      why_1: 'Unwashed / contaminated surface observed.',
      why_2: 'Wash cycle parameters or chemistry out of range.',
      why_3: 'Washer maintenance / concentration check missed.',
      why_4: 'No outgoing cleanliness verification for critical zones.',
      why_5: 'Work instruction for wash load density incomplete.',
      corrective_action: 'Re-wash affected parts, correct wash parameters, and re-inspect cleanliness.',
      preventive_action: 'Daily wash chemistry check and cleanliness gate before packing.',
    },
    'Dimension Problem': {
      severity: 'Major',
      process: 'Machining / Inspection',
      root_cause: `Process capability / measurement gap leading to dimension issue on ${part}.`,
      why_1: `Dimension problem detected: ${problem}`,
      why_2: 'Process setting drifted from validated condition.',
      why_3: 'In-process measurement did not catch drift early.',
      why_4: 'Control limits / reaction plan not followed.',
      why_5: 'Capability monitoring for this CTQ incomplete.',
      corrective_action: 'Contain lot, re-measure CTQ, correct process setting, and sort nonconforming parts.',
      preventive_action: 'Strengthen SPC for CTQ dimensions and document reaction plan at the station.',
    },
  };

  const t = templates[cat] || {
    severity: 'Major',
    process: 'Quality / Manufacturing',
    root_cause: `Process control gap caused ${cat} on ${part}.`,
    why_1: `Defect observed: ${cat}.`,
    why_2: 'Immediate process condition allowed nonconformance.',
    why_3: 'Detection control did not stop escape.',
    why_4: 'Standard reaction plan not executed in time.',
    why_5: 'Systemic control-plan weakness for this failure mode.',
    corrective_action: `Contain affected lot of ${part}, correct process, and re-inspect before release.`,
    preventive_action: `Update control plan for ${cat}, add detection checkpoint, and train operators.`,
  };

  return {
    ...row,
    severity: t.severity,
    process: t.process,
    root_cause: t.root_cause,
    why_1: t.why_1,
    why_2: t.why_2,
    why_3: t.why_3,
    why_4: t.why_4,
    why_5: t.why_5,
    why_why: [t.why_1, t.why_2, t.why_3, t.why_4, t.why_5].join(' | '),
    corrective_action: t.corrective_action,
    preventive_action: t.preventive_action,
  };
}

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source Excel not found: ${SRC}`);
  const wb = XLSX.readFile(SRC);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const enriched = rows.map(seedFor);

  const outWb = XLSX.utils.book_new();
  const outSheet = XLSX.utils.json_to_sheet(enriched, {
    header: [
      'ims_refno',
      'item_code',
      'item_name',
      'party_code',
      'problem_statement',
      'lot_qty',
      'defect_qty',
      'date_of_issue',
      'defect_category',
      'severity',
      'process',
      'root_cause',
      'why_1',
      'why_2',
      'why_3',
      'why_4',
      'why_5',
      'why_why',
      'corrective_action',
      'preventive_action',
    ],
  });
  XLSX.utils.book_append_sheet(outWb, outSheet, 'historic');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  XLSX.writeFile(outWb, OUT_PATH);
  XLSX.writeFile(outWb, DOWNLOADS_PATH);

  const buf = fs.readFileSync(OUT_PATH);
  const { meta, cases } = await importHistoricBuffer(buf, OUT_NAME, 'excel-seed');
  const sample = cases[0];
  console.log('Wrote', OUT_PATH);
  console.log('Also', DOWNLOADS_PATH);
  console.log('Imported', meta.recordCount, 'records');
  console.log('Sample RCA:', sample.rootCause);
  console.log('Sample Why count:', sample.whyWhy.length);
  console.log('Sample CA:', sample.correctiveAction.slice(0, 80));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
