/**
 * activity.ts — Carbon Activity Log Routes
 *
 * POST   /api/activities        - Log a new activity (requires auth)
 * GET    /api/activities        - Get current user's activities (requires auth)
 * DELETE /api/activities/:id    - Delete a specific activity (requires auth)
 *
 * Full implementation is in Phase 2. Stub routes return 501 until then.
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getPrisma } from '../lib/db';
import { calculateCO2 } from '../lib/carbon';
import { z } from 'zod';

const router = Router();

// ─── Validation Schema ────────────────────────────────────────────────────────

const ActivitySchema = z.object({
  activityType: z.enum(['transit', 'food', 'energy']),
  label: z.string().min(1).max(100),
  value: z.number().positive(),
  unit: z.enum(['km', 'grams', 'kwh', 'litres', 'kg']),
});

// ─── POST /api/activities ─────────────────────────────────────────────────────

router.post('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = ActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const { activityType, label, value, unit } = parsed.data;
    const firebaseUid = req.user!.uid;

    // Resolve internal userId from firebaseUid
    const user = await getPrisma().user.findUnique({ where: { firebaseUid } });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please complete sign-up.' });
    }

    // Pre-calculate CO₂ at write time — never trust client-provided values
    const co2Kg = calculateCO2(activityType, label, value, unit);

    const activity = await getPrisma().activityLog.create({
      data: { userId: user.id, activityType, label, value, unit, co2Kg },
    });

    return res.status(201).json({ activity });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/activities ──────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const firebaseUid = req.user!.uid;
    const user = await getPrisma().user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Optional query params: ?days=7 (default 30)
    const days = Math.min(Number(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const activities = await getPrisma().activityLog.findMany({
      where: { userId: user.id, loggedAt: { gte: since } },
      select: { id: true, activityType: true, label: true, value: true, unit: true, co2Kg: true, loggedAt: true },
      orderBy: { loggedAt: 'desc' },
    });

    return res.json({ activities });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/activities/:id ───────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const activityId = Number(req.params.id);
    if (isNaN(activityId)) return res.status(400).json({ error: 'Invalid activity ID.' });

    const firebaseUid = req.user!.uid;
    const user = await getPrisma().user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // IDOR protection: ensure the activity belongs to this user
    const existing = await getPrisma().activityLog.findFirst({
      where: { id: activityId, userId: user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Activity not found.' });

    await getPrisma().activityLog.delete({ where: { id: activityId } });
    return res.status(200).json({ message: 'Activity deleted.' });
  } catch (err) {
    next(err);
  }
});

export default router;
