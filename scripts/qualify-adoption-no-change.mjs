// Maintainer-only oracle, frozen before the healthy counterpart. Not runtime authority.
export const noChangeOracle = Object.freeze({
  requiredPass: ['C05.01', 'C06.02', 'C10.02', 'C15.01', 'C15.02', 'C19.01', 'C19.02'],
  outsideCoverage: ['C11.02', 'C12.04', 'C14.01', 'C15.03', 'C23.01', 'C24.05', 'C28.01'],
  result: 'SCOPED_NO_CHANGE_WITH_RETAINED_LIMITS',
  limits: ['not pristine project health', 'independent semantic review must confirm each claimed scope exclusion',
    'no mutation of any staged project file, no repair or execution, no paused-task resumption',
    'every remaining limit requires actual owner disposition and unique lease before completion']
});
export function checkScopedNoChange(health) {
  const fail = code => {throw Error(code);};
  if (!Array.isArray(health?.review?.rows) || !Array.isArray(health.findings)) fail('NO_CHANGE_REVIEW_REQUIRED');
  const rows = health.review.rows, open = health.findings.filter(f => f.status === 'OPEN');
  for (const id of noChangeOracle.requiredPass) {
    const matching = rows.filter(row => row.id === id);
    if (matching.length !== 1 || matching[0].status !== 'PASS' || !matching[0].evidence) fail(`NO_CHANGE_SCOPE_UNPROVEN:${id}`);
  }
  // A nonblocking label cannot turn a demonstrated defect into healthy evidence.
  if (rows.some(row => row.status === 'FINDING')) fail('NO_CHANGE_DEMONSTRATED_DEFECT');
  for (const finding of open) {
    const row = rows.find(row => row.findingId === finding.id && row.id === finding.checkId);
    if (finding.blocksResume !== false || !noChangeOracle.outsideCoverage.includes(finding.checkId) ||
        finding.work === 'maintenance' || !['UNKNOWN', 'DEFERRED'].includes(row?.status) ||
        !row.reason || !row.evidence || !finding.evidence || !finding.owner || !finding.work ||
        !Number.isFinite(Date.parse(finding.reviewAt))) fail(`NO_CHANGE_UNOWNED_OR_IN_SCOPE:${finding.id}`);
  }
  return {status: noChangeOracle.result, retained: open.map(({id, checkId, owner, work, reviewAt}) => ({id, checkId, owner, work, reviewAt})),
    acceptance: 'CANDIDATE_REQUIRES_OWNER_APPLICATION_AND_INDEPENDENT_SEMANTIC_CHECK'};
}
