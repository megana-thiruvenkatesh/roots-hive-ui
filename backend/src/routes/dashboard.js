const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows: all } = await pool.query(
      `SELECT c.*,
              u.name AS assigned_name,
              creator.name AS created_by_name
       FROM complaints c
       LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN users creator ON creator.id = c.created_by
       ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC`
    );

    const scoped = all;

    const open = scoped.filter((c) => c.stage !== 'Closed').length;
    const closed = scoped.filter((c) => c.stage === 'Closed').length;
    const critical = scoped.filter((c) => c.severity === 'Critical').length;
    const pendingApproval = scoped.filter((c) =>
      ['Pending Approval', 'CAPA', 'Verification', 'Approved'].includes(c.stage)
    ).length;
    const myOpen = scoped.filter(
      (c) => c.assigned_to === userId && c.stage !== 'Closed'
    ).length;

    const byStage = {};
    const bySeverity = {};
    const byCategory = {};
    scoped.forEach((c) => {
      const stage = c.stage || 'Unknown';
      const severity = c.severity || 'Unknown';
      const cat = c.defect_category || 'Uncategorized';
      byStage[stage] = (byStage[stage] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });

    const mapItem = (c) => ({
      id: c.id,
      desc: c.description,
      severity: c.severity,
      stage: c.stage,
      part: c.part,
      defectCat: c.defect_category || 'Uncategorized',
      assignedName: c.assigned_name,
      updatedAt: c.updated_at,
    });

    const recent = scoped.slice(0, 8).map(mapItem);
    const items = scoped.map(mapItem);

    const focus = 'Track CAPA health, critical risk, pending approvals, and recent activity';

    res.json({
      role: req.user.roleKey,
      focus,
      stats: {
        total: scoped.length,
        open,
        closed,
        critical,
        pendingApproval,
        myOpen,
      },
      byStage,
      bySeverity,
      byCategory,
      recent,
      items,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
