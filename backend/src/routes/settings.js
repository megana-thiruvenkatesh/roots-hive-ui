const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED = new Set(['api_settings', 'branding', 'workflow_config', 'appearance', 'policy_config', 'modules_config', 'ai_behavior', 'ai_models', 'regional_settings', 'local_folder_rag']);

router.get('/:key', async (req, res) => {
  if (!ALLOWED.has(req.params.key)) return res.status(404).json({ error: 'Unknown settings key' });
  try {
    const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [req.params.key]);
    res.json({ key: req.params.key, value: rows[0]?.value || {} });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.put('/:key', async (req, res) => {
  if (!ALLOWED.has(req.params.key)) return res.status(404).json({ error: 'Unknown settings key' });
  try {
    const value = { ...(req.body || {}) };
    delete value.apiKey;
    delete value.anthropicKey;
    delete value.openaiKey;

    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [req.params.key, JSON.stringify(value)]
    );
    res.json({ key: req.params.key, value });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
