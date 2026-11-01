// backend/src/routes/templates.routes.js
'use strict';
const { z } = require('zod');
const base = require('../controllers/base.controller');
const templates = require('../services/templates.service');
const { requireAuth } = require('../middleware/auth');
const httpValidate = require('../middleware/http').validate;

// Fallback role check: roles is array of strings from JWT payload
function hasRole(allowed) {
  return (req, _res, next) => {
    const roles = (req.user && req.user.roles) || [];
    if (allowed.some(r => roles.includes(r))) return next();
    const e = new Error('forbidden'); e.status = 403; throw e;
  };
}

function Router() { return require('express').Router(); }
const router = Router();

router.use(requireAuth); // ensure auth everywhere

// List templates
router.get('/', httpValidate(z.object({ query: z.object({ category: z.string().optional(), limit: z.string().max(8).optional() }).strict().optional() }).strict().optional()), async (req, res) => {
  const q = req.valid.query || {};
  return base.wrap(res, async () => templates.list({ category: q.category || undefined, limit: parseInt(q.limit, 10) || 50 }));
});

// Get template by name (for runtime use)
router.get('/by-name/:name', async (req, res) => {
  return base.wrap(res, async () => {
    const t = await templates.getByName(req.params.name);
    if (!t) {
      const e = new Error('template_not_found');
      e.status = 404;
      throw e;
    }
    return { ok: true, template: t };
  });
});

// Create template (admin/superadmin only)
router.post('/', requireAuth, hasRole(['admin', 'superadmin']), httpValidate(z.object({ body: z.object(templates.createSchema()).strict() }).strict()), async (req, res) => {
  return base.wrap(res, async () => templates.create(req.valid.body));
});

// Update template (admin/superadmin only)
router.put('/:id', requireAuth, hasRole(['admin', 'superadmin']), httpValidate(z.object({ params: z.object({ id: z.string().max(40) }), body: z.object(templates.updateSchema()).strict() }).strict()), async (req, res) => {
  return base.wrap(res, async () => templates.update(req.params.id, req.valid.body));
});

// Delete template (admin/superadmin only)
router.delete('/:id', requireAuth, hasRole(['admin', 'superadmin']), httpValidate(z.object({ params: z.object({ id: z.string().max(40) }) }).strict()), async (req, res) => {
  return base.wrap(res, async () => templates.delete(req.params.id));
});

module.exports = router;
