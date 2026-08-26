function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatCardDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(value.trim())) return value.trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return `${pad(parsed.getDate())}-${pad(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

function sectionDate(section = {}, fallback) {
  return (
    section.MODIFIED_DATETIME ||
    section.updatedAt ||
    section.PREPARED_DATETIME ||
    section.filledAt ||
    fallback ||
    null
  );
}

function display(value) {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    const parts = value.map((entry) => String(entry).trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }
  return String(value);
}

function card(group, key, label, value, date, extra = {}) {
  const empty = value == null || value === '' || value === '—';
  return {
    group,
    key: `${group}-${key}`,
    label,
    value: empty ? '—' : value,
    date: formatCardDate(date),
    empty,
    ...extra,
  };
}

function qaNetworkValue(raw) {
  if (!raw) return '—';
  return String(raw)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
}

function provenanceValue(section = {}) {
  const prepared = [section.PREPARED_BY, formatCardDate(section.PREPARED_DATETIME)].filter(Boolean).join(' · ');
  const modified = [section.MODIFIED_BY, formatCardDate(section.MODIFIED_DATETIME)].filter(Boolean).join(' · ');
  if (!prepared && !modified) return '—';
  return [
    prepared ? `Prepared ${prepared}` : null,
    modified ? `Modified ${modified}` : null,
  ].filter(Boolean).join('\n');
}

function effectivenessCards(group, months, date) {
  const rows = Array.isArray(months) ? months : [];
  return [0, 1, 2].map((index) => {
    const month = rows[index] || {};
    const filled = Object.values(month).some((value) => value != null && value !== '');
    const value = filled
      ? [
          `${month.year || '—'} / ${month.month || '—'}`,
          `Inspected ${display(month.inspected)}`,
          `Rejected ${display(month.rejection)}`,
          `Rework ${display(month.rework)}`,
          `Accepted ${display(month.acceptedQty)}`,
          `Acknowledged ${display(month.acknowledged)}`,
        ].join('\n')
      : '—';
    return card(group, `month-${index + 1}`, `Effectiveness Month ${index + 1}`, value, month.date || date);
  });
}

function fallbackChunk(item = {}) {
  const why = Array.isArray(item.whyWhy) ? item.whyWhy : [];
  const idParts = String(item.id || '').split(/[-_]/);
  return {
    header: {
      IMS_PREFIX: idParts[0] || 'CASE',
      IMS_REFNO: idParts.slice(1).join('-') || item.id || '',
      IMS_TYPEID: item.sourceType === 'Supplier' ? 2 : 1,
      IMS_SUBTYPEID: 1,
      PREPARED_DATETIME: item.recordDate,
      MODIFIED_DATETIME: item.recordDate,
    },
    detail: {
      SPN_Number: item.id,
      IMS_PARTY: item.customer || item.party || '',
      IMS_ITEMCODE: item.partCode || item.part || '',
      IMS_ITEMNAME: item.part || item.symptom || '',
      IMS_DATEOFISSUE: item.recordDate,
      IMS_LOTQTY: item.lotQty || '',
      IMS_DEFECTQTY: item.defectQty || '',
      IMS_DEFECTCATEGORY: item.defectCat || item.symptom || '',
      FinYear: item.recordDate ? new Date(item.recordDate).getFullYear() : '',
      PREPARED_DATETIME: item.recordDate,
      MODIFIED_DATETIME: item.recordDate,
    },
    step2: {
      IMS_PROBLEMSTATEMENT: item.description || '',
      PREPARED_DATETIME: item.recordDate,
    },
    containment: {
      IMS_AreaLocation: item.stage || '',
      PREPARED_DATETIME: item.recordDate,
    },
    simulation: {
      IMS_SIMULATIONTEST: '',
      IMS_MECHANISMOFOCCUR: '',
      PREPARED_DATETIME: item.recordDate,
    },
    rca: {
      IMS_PROABABLE_DESC: 'Occurrence',
      IMS_WHY1: why[0] || '',
      IMS_WHY2: why[1] || '',
      IMS_WHY3: why[2] || '',
      IMS_WHY4: why[3] || '',
      IMS_WHY: item.rootCause || '',
      PREPARED_DATETIME: item.recordDate,
      MODIFIED_DATETIME: item.recordDate,
    },
    ca: {
      IMS_FA_TYPE: 'Occurrence',
      IMS_CORRECTIVEACTION: item.correctiveAction || '',
      IMS_RESPONSIBLE: '',
      IMS_TARGETDATE: '',
      PREPARED_DATETIME: item.recordDate,
    },
    pa: {
      IMS_QANETWORK: '',
      IMS_ONSITEVERIFICATION: item.preventiveAction || '',
      PREPARED_DATETIME: item.recordDate,
    },
    effectiveness: {
      PREPARED_DATETIME: item.recordDate,
      months: [],
    },
  };
}

export function getHistoricChunk(item = {}) {
  return item.chunk && typeof item.chunk === 'object'
    ? item.chunk
    : fallbackChunk(item);
}

export function chunkSearchText(item = {}) {
  const chunk = getHistoricChunk(item);
  return JSON.stringify(chunk);
}

export function buildHistoricAttributeGroups(item = {}) {
  const chunk = getHistoricChunk(item);
  const caseDate = item.recordDate || chunk.detail?.IMS_DATEOFISSUE;

  const header = chunk.header || {};
  const detail = chunk.detail || {};
  const step2 = chunk.step2 || {};
  const containment = chunk.containment || {};
  const containmentHeader = chunk.containmentHeader || {};
  const simulation = chunk.simulation || {};
  const rca = chunk.rca || {};
  const ca = chunk.ca || {};
  const pa = chunk.pa || {};
  const effectiveness = chunk.effectiveness || {};

  const headerDate = sectionDate(header, caseDate);
  const detailDate = sectionDate(detail, caseDate);
  const step2Date = sectionDate(step2, detailDate);
  const containmentDate = sectionDate(containment, sectionDate(containmentHeader, caseDate));
  const simulationDate = sectionDate(simulation, caseDate);
  const rcaDate = sectionDate(rca, caseDate);
  const caDate = sectionDate(ca, caseDate);
  const paDate = sectionDate(pa, caseDate);
  const effectivenessDate = sectionDate(effectiveness, caseDate);

  return [
    {
      key: 'header',
      title: 'Header',
      cards: [
        card('header', 'ref', 'Case Reference', `${display(header.IMS_PREFIX)}-${display(header.IMS_REFNO)}`.replace('—-—', '—'), headerDate),
        card('header', 'type', 'Case Type', `Type ${display(header.IMS_TYPEID)} / Subtype ${display(header.IMS_SUBTYPEID)}`, headerDate),
        card('header', 'prov', 'Record Provenance', provenanceValue(header), headerDate),
      ],
    },
    {
      key: 'detail',
      title: 'Detail',
      cards: [
        card('detail', 'spn', 'SPN Number', display(detail.SPN_Number), detailDate),
        card('detail', 'party', 'Supplier (IMS_PARTY)', display(detail.IMS_PARTY), detailDate),
        card('detail', 'item', 'Item', [detail.IMS_ITEMCODE, detail.IMS_ITEMNAME].filter(Boolean).join(' · ') || '—', detailDate),
        card('detail', 'issue', 'Date of Issue', formatCardDate(detail.IMS_DATEOFISSUE) || '—', detail.IMS_DATEOFISSUE || detailDate),
        card('detail', 'qty', 'Lot / Defect Qty', `Lot ${display(detail.IMS_LOTQTY)} · Defect ${display(detail.IMS_DEFECTQTY)}`, detailDate),
        card('detail', 'fin', 'Financial Year', display(detail.FinYear), detailDate),
        card('detail', 'prov', 'Record Provenance', provenanceValue(detail), detailDate),
      ],
    },
    {
      key: 'step2',
      title: 'Problem Statement',
      cards: [
        card('step2', 'problem', 'Brief Description', display(step2.IMS_PROBLEMSTATEMENT), step2Date, { wide: true }),
      ],
    },
    {
      key: 'containment',
      title: 'Containment',
      cards: [
        card('containment', 'area', 'Area / Location', display(containment.IMS_AreaLocation), containmentDate),
        card('containment', 'inspected', 'Parts Inspected', display(containment.IMS_NoofPartsinspected), containmentDate),
        card('containment', 'method', 'Inspection Method', display(containment.IMS_Inspectionmethod), containmentDate),
        card('containment', 'ok', 'OK / Not OK Qty', `OK ${display(containment.IMS_OKQty)} · Not OK ${display(containment.IMS_NotOKQty)}`, containmentDate),
        card('containment', 'remarks', 'Containment Remarks', display(containmentHeader.ContainmentRemarks || containment.ContainmentRemarks), containmentDate, { wide: true }),
      ],
    },
    {
      key: 'simulation',
      title: 'Simulation / Mechanism',
      cards: [
        card('simulation', 'test', 'Simulation Test', display(simulation.IMS_SIMULATIONTEST), simulationDate, { wide: true }),
        card('simulation', 'mech', 'Mechanism of Occurrence', display(simulation.IMS_MECHANISMOFOCCUR), simulationDate, { wide: true }),
      ],
    },
    {
      key: 'rca',
      title: 'RCA',
      cards: [
        card('rca', 'branch', 'RCA Branch', display(rca.IMS_PROABABLE_DESC), rcaDate),
        card('rca', 'why1', 'Why 1', display(rca.IMS_WHY1), rcaDate),
        card('rca', 'why2', 'Why 2', display(rca.IMS_WHY2), rcaDate),
        card('rca', 'why3', 'Why 3', display(rca.IMS_WHY3), rcaDate),
        card('rca', 'why4', 'Why 4', display(rca.IMS_WHY4), rcaDate),
        card('rca', 'final', 'Root Cause (IMS_WHY)', display(rca.IMS_WHY), rcaDate, { wide: true }),
      ],
    },
    {
      key: 'ca',
      title: 'Corrective Action',
      cards: [
        card('ca', 'type', 'CA Branch', display(ca.IMS_FA_TYPE), caDate),
        card('ca', 'action', 'Corrective Action', display(ca.IMS_CORRECTIVEACTION), caDate, { wide: true }),
        card('ca', 'owner', 'Responsible', display(ca.IMS_RESPONSIBLE), caDate),
        card('ca', 'target', 'Target Date', formatCardDate(ca.IMS_TARGETDATE) || '—', ca.IMS_TARGETDATE || caDate),
      ],
    },
    {
      key: 'pa',
      title: 'Preventive Action',
      cards: [
        card('pa', 'qa', 'QA Network', qaNetworkValue(pa.IMS_QANETWORK), paDate, { wide: true }),
        card('pa', 'verify', 'Onsite Verification', display(pa.IMS_ONSITEVERIFICATION), paDate, { wide: true }),
      ],
    },
    {
      key: 'effectiveness',
      title: 'Effectiveness',
      cards: effectivenessCards('effectiveness', effectiveness.months, effectivenessDate),
    },
  ];
}

/** Same labels/layout as New Complaint page 1, filled from a historic case. */
export function buildHistoricComplaintFormFields(item = {}) {
  const chunk = getHistoricChunk(item);
  const header = chunk.header || {};
  const detail = chunk.detail || {};
  const step2 = chunk.step2 || {};
  const typeId = Number(header.IMS_TYPEID);
  const complaintType =
    item.sourceType ||
    item.source ||
    item.type ||
    (typeId === 2 ? 'Supplier' : typeId === 1 ? 'Internal' : '');
  const issueDate = detail.IMS_DATEOFISSUE || item.recordDate || '';

  return {
    complaintType: display(complaintType),
    severity: display(item.severity || item.issueSeverity),
    dateOfIssue: formatCardDate(issueDate) || display(issueDate),
    itemCode: display(detail.IMS_ITEMCODE || item.partCode),
    itemName: display(detail.IMS_ITEMNAME || item.part),
    problemDescription: display(step2.IMS_PROBLEMSTATEMENT || item.description),
    defectCategory: display(item.defectCat || item.symptom || detail.IMS_DEFECTCATEGORY),
    partyCode: display(detail.IMS_PARTY || item.customer || item.party),
    lotQty: display(detail.IMS_LOTQTY || item.lotQty),
    defectQty: display(detail.IMS_DEFECTQTY || item.defectQty),
  };
}

/** Flat detail rows shown above RCA / Why-Why / CA-PA cards (not as cards). */
export function buildHistoricDetailFields(item = {}) {
  const chunk = getHistoricChunk(item);
  const header = chunk.header || {};
  const detail = chunk.detail || {};
  const step2 = chunk.step2 || {};
  const containment = chunk.containment || {};
  const containmentHeader = chunk.containmentHeader || {};
  const simulation = chunk.simulation || {};
  const effectiveness = chunk.effectiveness || {};

  const rows = [
    { label: 'Case Reference', value: `${display(header.IMS_PREFIX)}-${display(header.IMS_REFNO)}`.replace('—-—', '—') },
    { label: 'Case Type', value: `Type ${display(header.IMS_TYPEID)} / Subtype ${display(header.IMS_SUBTYPEID)}` },
    { label: 'SPN Number', value: display(detail.SPN_Number || item.id) },
    { label: 'Supplier / Customer', value: display(detail.IMS_PARTY || item.customer || item.party) },
    {
      label: 'Part',
      value: [detail.IMS_ITEMCODE || item.partCode, detail.IMS_ITEMNAME || item.part].filter(Boolean).join(' · ') || '—',
    },
    { label: 'Symptom', value: display(item.symptom || item.defectCat) },
    { label: 'Lot Qty', value: display(detail.IMS_LOTQTY || item.lotQty) },
    { label: 'Defect Qty', value: display(detail.IMS_DEFECTQTY || item.defectQty) },
    { label: 'Financial Year', value: display(detail.FinYear) },
    {
      label: 'Problem Statement',
      value: display(step2.IMS_PROBLEMSTATEMENT || item.description),
      full: true,
    },
    { label: 'Containment Area', value: display(containment.IMS_AreaLocation || item.stage) },
    { label: 'Parts Inspected', value: display(containment.IMS_NoofPartsinspected) },
    { label: 'Inspection Method', value: display(containment.IMS_Inspectionmethod) },
    { label: 'OK Qty', value: display(containment.IMS_OKQty), full: true },
    { label: 'Not OK Qty', value: display(containment.IMS_NotOKQty), full: true },
    {
      label: 'Containment Remarks',
      value: display(containmentHeader.ContainmentRemarks || containment.ContainmentRemarks),
    },
    { label: 'Simulation Test', value: display(simulation.IMS_SIMULATIONTEST) },
    { label: 'Mechanism of Occurrence', value: display(simulation.IMS_MECHANISMOFOCCUR) },
  ];

  const months = Array.isArray(effectiveness.months) ? effectiveness.months : [];
  months.forEach((month, index) => {
    const filled = month && Object.values(month).some((value) => value != null && value !== '');
    if (!filled) return;
    rows.push({
      label: `Effectiveness Month ${index + 1}`,
      value: [
        `${month.year || '—'} / ${month.month || '—'}`,
        `Inspected ${display(month.inspected)}`,
        `Rejected ${display(month.rejection)}`,
        `Rework ${display(month.rework)}`,
        `Accepted ${display(month.acceptedQty)}`,
      ].join(' · '),
    });
  });

  return rows.filter((row) => row.value && row.value !== '—' && row.value !== 'Type — / Subtype —');
}

function listLines(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  const text = String(value || '').trim();
  if (!text || text === '—') return [];
  return text.split(/\n+|;\s*(?=[A-Z0-9])/).map((line) => line.replace(/^\d+[\).\s]+/, '').trim()).filter(Boolean);
}

function pct(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n > 1 && n <= 100 ? n : n * 100)));
}

/** Summary + expandable sections for a historic case card (reference layout). */
export function buildHistoricCaseView(item = {}) {
  const chunk = getHistoricChunk(item);
  const header = chunk.header || {};
  const detail = chunk.detail || {};
  const step2 = chunk.step2 || {};
  const containment = chunk.containment || {};
  const containmentHeader = chunk.containmentHeader || {};
  const simulation = chunk.simulation || {};
  const rca = chunk.rca || {};
  const ca = chunk.ca || {};
  const pa = chunk.pa || {};
  const effectiveness = chunk.effectiveness || {};
  const caseDate = item.recordDate || detail.IMS_DATEOFISSUE;
  const typeId = Number(header.IMS_TYPEID);
  const sourceType = item.sourceType || item.source || (typeId === 2 ? 'Supplier' : typeId === 1 ? 'Internal' : 'Historic');
  const overall = pct(item.similarityScore ?? item.confidence, 0);
  const problemSim = pct(item.textScore ?? item.text_similarity, overall);
  const contextSim = pct(item.contextScore ?? item.structured_bonus, Math.max(0, overall - 5));
  const matchTone = overall >= 80 ? 'high' : overall >= 50 ? 'mid' : 'low';
  const matchLabel = overall >= 80 ? 'Strong match' : overall >= 50 ? 'Moderate match' : 'Weak match';

  const itemCode = display(detail.IMS_ITEMCODE || item.partCode);
  const itemName = display(detail.IMS_ITEMNAME || item.part);
  const category = display(item.defectCat || item.symptom || detail.IMS_DEFECTCATEGORY);
  const signals = [];
  if (problemSim >= 70) signals.push('Very similar problem wording');
  if (itemCode !== '—') signals.push('Same item code');
  if (itemName !== '—') signals.push('Same item name');
  if (category !== '—') signals.push('Same defect category');

  const containmentRows = Array.isArray(containment.rows) && containment.rows.length
    ? containment.rows
    : [{
      location: containment.IMS_AreaLocation || item.stage || '—',
      inspected: containment.IMS_NoofPartsinspected || '—',
      method: containment.IMS_Inspectionmethod || '—',
      ok: containment.IMS_OKQty || '—',
      notOk: containment.IMS_NotOKQty || '—',
    }];

  const occurrenceLines = listLines(rca.occurrence || rca.IMS_OCCURRENCE || [rca.IMS_WHY1, rca.IMS_WHY2].filter(Boolean));
  const detectionLines = listLines(rca.detection || rca.IMS_DETECTION || [rca.IMS_WHY3, rca.IMS_WHY4].filter(Boolean));
  const whyLines = [rca.IMS_WHY1, rca.IMS_WHY2, rca.IMS_WHY3, rca.IMS_WHY4]
    .map((value, index) => {
      const text = String(value || '').trim();
      return text ? `Why ${index + 1}: ${text}` : null;
    })
    .filter(Boolean);
  const whyFromItem = Array.isArray(item.whyWhy)
    ? item.whyWhy.map((text, index) => `Why ${index + 1}: ${text}`).filter((line) => !line.endsWith(': '))
    : [];
  const occCa = display(ca.occurrence || (String(ca.IMS_FA_TYPE || '').toLowerCase().includes('detect') ? '' : ca.IMS_CORRECTIVEACTION) || item.correctiveAction);
  const detCa = display(ca.detection || (String(ca.IMS_FA_TYPE || '').toLowerCase().includes('detect') ? ca.IMS_CORRECTIVEACTION : ''));

  return {
    id: item.id || display(detail.SPN_Number),
    sourceType,
    overall,
    matchTone,
    matchLabel,
    problem: display(step2.IMS_PROBLEMSTATEMENT || item.description),
    issueDate: formatCardDate(detail.IMS_DATEOFISSUE || caseDate) || '—',
    metadata: [
      { label: 'Item Code', value: itemCode },
      { label: 'Item Name', value: itemName },
      { label: 'Supplier', value: display(detail.IMS_PARTY || item.customer || item.party) },
      { label: 'Category', value: category },
      { label: 'Issue Date', value: formatCardDate(detail.IMS_DATEOFISSUE || caseDate) || '—' },
      { label: 'Lot Quantity', value: display(detail.IMS_LOTQTY || item.lotQty) },
      { label: 'Defect Quantity', value: display(detail.IMS_DEFECTQTY || item.defectQty) },
      { label: 'Source', value: display(item.source || sourceType) },
    ],
    signals,
    problemSim,
    contextSim,
    sections: [
      {
        key: 'rca',
        title: 'RCA',
        date: formatCardDate(sectionDate(rca, caseDate)),
        showDate: true,
        wide: true,
        confirmed: display(rca.IMS_WHY || item.rootCause),
        lines: occurrenceLines.length ? occurrenceLines : listLines(rca.IMS_WHY || item.rootCause),
      },
      {
        key: 'why-why',
        title: 'Why-Why',
        date: formatCardDate(sectionDate(rca, caseDate)),
        showDate: true,
        wide: true,
        lines: whyLines.length ? whyLines : whyFromItem,
      },
      {
        key: 'containment',
        title: 'Containment Response',
        date: formatCardDate(sectionDate(containment, sectionDate(containmentHeader, caseDate))),
        wide: true,
        table: {
          columns: ['Location', 'Inspected', 'Method', 'OK', 'Not OK'],
          rows: containmentRows.map((row) => [
            display(row.location || row.IMS_AreaLocation),
            display(row.inspected || row.IMS_NoofPartsinspected),
            display(row.method || row.IMS_Inspectionmethod),
            display(row.ok || row.IMS_OKQty),
            display(row.notOk || row.IMS_NotOKQty),
          ]),
        },
        remarks: display(containmentHeader.ContainmentRemarks || containment.ContainmentRemarks),
      },
      {
        key: 'occurrence-rca',
        title: 'Occurrence Root Cause',
        date: formatCardDate(sectionDate(rca, caseDate)),
        lines: occurrenceLines,
        confirmed: display(rca.occurrenceConfirmed || (String(rca.IMS_PROABABLE_DESC || '').toLowerCase().includes('detect') ? '' : rca.IMS_WHY) || item.rootCause),
      },
      {
        key: 'detection-rca',
        title: 'Detection Root Cause',
        date: formatCardDate(sectionDate(rca, caseDate)),
        lines: detectionLines,
        confirmed: display(rca.detectionConfirmed || (String(rca.IMS_PROABABLE_DESC || '').toLowerCase().includes('detect') ? rca.IMS_WHY : '')),
      },
      {
        key: 'investigation',
        title: 'Investigation Context',
        date: formatCardDate(sectionDate(simulation, caseDate)),
        wide: true,
        fields: [
          { label: 'Simulation test', value: display(simulation.IMS_SIMULATIONTEST) },
          { label: 'Mechanism of occurrence', value: display(simulation.IMS_MECHANISMOFOCCUR) },
        ],
      },
      {
        key: 'occurrence-ca',
        title: 'Occurrence Corrective Action',
        date: formatCardDate(sectionDate(ca, caseDate)),
        showDate: true,
        text: occCa,
        owner: [ca.IMS_RESPONSIBLE, formatCardDate(ca.IMS_TARGETDATE)].filter(Boolean).join(' · ') || '—',
      },
      {
        key: 'detection-ca',
        title: 'Detection Corrective Action',
        date: formatCardDate(ca.detectionDate || sectionDate(ca, caseDate)),
        showDate: true,
        lines: listLines(ca.detectionAction || detCa),
        owner: [ca.detectionOwner || ca.IMS_RESPONSIBLE, formatCardDate(ca.IMS_TARGETDATE)].filter(Boolean).join(' · ') || '—',
      },
      {
        key: 'pa',
        title: 'Preventive Action',
        date: formatCardDate(sectionDate(pa, caseDate)),
        showDate: true,
        text: display(pa.IMS_QANETWORK ? qaNetworkValue(pa.IMS_QANETWORK) : pa.IMS_ONSITEVERIFICATION || item.preventiveAction),
        verification: display(pa.IMS_ONSITEVERIFICATION || item.preventiveAction),
      },
      {
        key: 'effectiveness',
        title: 'Effectiveness Monitoring',
        date: formatCardDate(sectionDate(effectiveness, caseDate)),
        table: {
          columns: ['Period', 'Inspected', 'Rejected', 'Rework'],
          rows: (Array.isArray(effectiveness.months) ? effectiveness.months : [])
            .filter((month) => month && Object.values(month).some((value) => value != null && value !== ''))
            .map((month) => [
              `${month.year || '—'} ${month.month || ''}`.trim(),
              display(month.inspected),
              display(month.rejection),
              display(month.rework),
            ]),
        },
      },
    ],
  };
}

/** Compact historic expand view: overall date stays on the result card; only RCA / Why-Why / CA-PA cards. */
export function buildHistoricSummaryCards(item = {}) {
  const chunk = getHistoricChunk(item);
  const caseDate = item.recordDate || chunk.detail?.IMS_DATEOFISSUE;
  const rca = chunk.rca || {};
  const ca = chunk.ca || {};
  const pa = chunk.pa || {};

  const rcaDate = sectionDate(rca, caseDate);
  const caDate = sectionDate(ca, caseDate);
  const paDate = sectionDate(pa, caseDate);

  function uniqueDates(...values) {
    const seen = new Set();
    return values.filter((value) => {
      if (value == null || value === '') return false;
      const parsed = new Date(value);
      const key = Number.isNaN(parsed.getTime()) ? String(value) : String(parsed.getTime());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const rootCause = display(rca.IMS_WHY || item.rootCause);
  const whyLines = [rca.IMS_WHY1, rca.IMS_WHY2, rca.IMS_WHY3, rca.IMS_WHY4]
    .map((value, index) => {
      const text = String(value || '').trim();
      return text ? `Why ${index + 1}: ${text}` : null;
    })
    .filter(Boolean);
  const whyFromItem = Array.isArray(item.whyWhy)
    ? item.whyWhy.map((text, index) => `Why ${index + 1}: ${text}`).filter((line) => !line.endsWith(': '))
    : [];
  const whyValue = (whyLines.length ? whyLines : whyFromItem).join('\n') || '—';

  const caText = display(ca.IMS_CORRECTIVEACTION || item.correctiveAction);
  const paText = display(pa.IMS_ONSITEVERIFICATION || item.preventiveAction);
  const capaValue = [
    `Corrective Action (CA): ${caText}`,
    `Preventive Action (PA): ${paText}`,
  ].join('\n');

  return [
    {
      key: 'rca',
      label: 'RCA',
      value: rootCause,
      dates: uniqueDates(rcaDate),
      empty: rootCause === '—',
      wide: true,
    },
    {
      key: 'why-why',
      label: 'Why-Why',
      value: whyValue,
      dates: uniqueDates(rcaDate),
      empty: whyValue === '—',
      wide: true,
    },
    {
      key: 'ca-pa',
      label: 'CA / PA',
      value: capaValue,
      caText,
      paText,
      dates: uniqueDates(caDate, paDate),
      empty: caText === '—' && paText === '—',
      wide: true,
    },
  ];
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|tiff?)$/i;

function looksLikeImage(entry = {}) {
  const name = String(entry.name || entry.filename || entry.path || entry.url || '');
  const mime = String(entry.mime || entry.type || entry.contentType || '');
  if (mime.startsWith('image/')) return true;
  if (IMAGE_EXT.test(name)) return true;
  if (entry.path || entry.filePath || entry.filepath || entry.FilePath) return true;
  return Boolean(entry.url && !String(entry.url).toLowerCase().includes('.pdf'));
}

function normalizeHistoricImage(entry, index) {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const pathValue = entry.trim();
    if (!pathValue) return null;
    return {
      id: `img-${index}`,
      name: pathValue.split(/[/\\]/).pop() || `Image ${index + 1}`,
      path: pathValue,
      src: resolveHistoricImageSrc(pathValue),
    };
  }
  if (typeof entry !== 'object') return null;
  const pathValue = [
    entry.path,
    entry.filePath,
    entry.filepath,
    entry.FilePath,
    entry.FILE_PATH,
    entry.url,
  ]
    .map((value) => (value == null ? '' : String(value).trim()))
    .find(Boolean);
  if (!pathValue || !looksLikeImage(entry)) return null;
  return {
    id: entry.id || `img-${index}`,
    name: entry.name || entry.filename || pathValue.split(/[/\\]/).pop() || `Image ${index + 1}`,
    path: pathValue,
    src: resolveHistoricImageSrc(pathValue),
  };
}

/** Turn a DB-stored file path into a browser URL. */
export function resolveHistoricImageSrc(storedPath) {
  const value = String(storedPath || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/uploads/') || value.startsWith('/api/')) return value;
  if (!/^[a-zA-Z]:[\\/]/.test(value) && !value.startsWith('\\\\')) {
    const relative = value.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    if (relative.toLowerCase().startsWith('historic/')) {
      return `/uploads/${relative}`;
    }
    return `/uploads/historic/${relative}`;
  }
  return `/api/historic-media?path=${encodeURIComponent(value)}`;
}

/** Collect image paths from historic case / DB attachment fields. */
export function getHistoricImages(item = {}) {
  const chunk = getHistoricChunk(item);
  const pools = [
    item.images,
    item.attachments,
    item.photos,
    item.media,
    chunk.images,
    chunk.attachments,
    chunk.photos,
    chunk.media,
  ];
  const collected = [];
  pools.forEach((pool) => {
    if (!Array.isArray(pool)) return;
    pool.forEach((entry) => collected.push(entry));
  });
  return collected
    .map((entry, index) => normalizeHistoricImage(entry, index))
    .filter(Boolean);
}
