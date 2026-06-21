/**
 * insights.ts — AI-Powered Personalized Carbon Insights Route
 *
 * POST /api/insights/generate  - Generate Gemini AI insights for the user
 * GET  /api/insights/latest    - Retrieve the most recent cached insight
 *
 * Insights are generated from the user's last 7 days of ActivityLog data
 * and cached in the DB for 24 hours to avoid redundant Gemini API calls.
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { getPrisma } from '../lib/db';
import { getAIClient } from '../lib/aiClient';
import { aggregateByDay, totalCO2, percentageChange } from '../lib/carbon';

const router = Router();

const CACHE_HOURS = 24;

// ─── POST /api/insights/generate ─────────────────────────────────────────────

router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const firebaseUid = req.user!.uid;
    const user = await getPrisma().user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Check for a fresh cached insight (< 24 hours old)
    const cacheThreshold = new Date(Date.now() - CACHE_HOURS * 60 * 60 * 1000);
    const cached = await getPrisma().insight.findFirst({
      where: { userId: user.id, createdAt: { gte: cacheThreshold } },
      orderBy: { createdAt: 'desc' },
    });

    if (cached) {
      return res.json({ insight: cached, cached: true });
    }

    // Fetch last 14 days of activities to allow week-over-week comparison
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const allActivities = await getPrisma().activityLog.findMany({
      where: { userId: user.id, loggedAt: { gte: fourteenDaysAgo } },
      select: { activityType: true, label: true, value: true, unit: true, co2Kg: true, loggedAt: true },
      orderBy: { loggedAt: 'asc' },
    });

    const thisWeek = allActivities.filter((a) => a.loggedAt >= sevenDaysAgo);
    const lastWeek = allActivities.filter((a) => a.loggedAt < sevenDaysAgo);

    if (thisWeek.length === 0) {
      return res.status(400).json({
        error: 'No activities logged this week. Log at least one activity to get insights.',
      });
    }

    // Aggregate for context-rich prompt
    const thisWeekTotal = totalCO2(thisWeek);
    const lastWeekTotal = totalCO2(lastWeek);
    const change = percentageChange(thisWeekTotal, lastWeekTotal);
    const dailyBreakdown = aggregateByDay(thisWeek);

    // Build a human-readable activity summary for the prompt
    const activitySummary = thisWeek
      .map((a) => `  - ${a.activityType}: ${a.label} (${a.value} ${a.unit}) → ${a.co2Kg} kg CO₂`)
      .join('\n');

    const prompt = `You are CarboNudge, a friendly and data-driven personal sustainability coach.

Analyze this user's carbon footprint data from the last 7 days and provide highly personalized, actionable insights.

CURRENT WEEK DATA:
Total CO₂: ${thisWeekTotal} kg
Activities logged:
${activitySummary}

PREVIOUS WEEK:
Total CO₂: ${lastWeekTotal > 0 ? lastWeekTotal + ' kg' : 'No data'}
Change: ${lastWeekTotal > 0 ? (change > 0 ? '+' : '') + change + '%' : 'N/A'}

DAILY BREAKDOWN (this week):
${dailyBreakdown.map((d) => `  ${d.date}: ${d.co2Kg} kg CO₂`).join('\n')}

INSTRUCTIONS:
1. Start with a brief, encouraging one-sentence summary of their week.
2. Identify their SINGLE biggest source of emissions and explain its impact with a specific number.
3. Give ONE highly specific, actionable tip tied directly to their logged activities (not generic advice).
4. If previous week data exists, comment on whether they are improving or need to focus more.
5. End with a realistic weekly CO₂ reduction target based on their actual behaviour patterns.

Format your response in clean Markdown with clear section headings. Be concise (under 250 words), specific, and encouraging.`;

    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const content = response.text ?? 'Unable to generate insights at this time.';

    // Cache the insight in the database
    const insight = await getPrisma().insight.create({
      data: {
        userId: user.id,
        content,
        periodStart: sevenDaysAgo,
        periodEnd: new Date(),
      },
    });

    return res.json({ insight, cached: false });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/insights/latest ─────────────────────────────────────────────────

router.get('/latest', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const firebaseUid = req.user!.uid;
    const user = await getPrisma().user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const insight = await getPrisma().insight.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!insight) {
      return res.status(404).json({ error: 'No insights generated yet.' });
    }

    return res.json({ insight });
  } catch (err) {
    next(err);
  }
});

export default router;
