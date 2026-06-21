import { Router } from "express";
import { getPrisma } from "../lib/db";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// GET /api/challenges/joined - Get IDs of challenges the current user has joined
router.get("/joined", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const joined = await prisma.challengeParticipant.findMany({
      where: { userId: user.id },
      select: { challengeId: true },
    });

    res.json(joined.map((j: { challengeId: string }) => j.challengeId));
  } catch (err) {
    next(err);
  }
});

// POST /api/challenges/:challengeId/join - Join a challenge
router.post("/:challengeId/join", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { challengeId } = req.params;
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const join = await prisma.challengeParticipant.upsert({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        challengeId,
      },
    });

    res.status(200).json({ success: true, join });
  } catch (err) {
    next(err);
  }
});

// POST /api/challenges/:challengeId/leave - Leave a challenge
router.post("/:challengeId/leave", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { challengeId } = req.params;
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: "User not found." });

    await prisma.challengeParticipant.deleteMany({
      where: {
        userId: user.id,
        challengeId,
      },
    });

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/challenges/stats - Get counts of participants for all challenges
router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: {
        _all: true,
      },
    });

    const stats = counts.reduce((acc: Record<string, number>, curr: { challengeId: string; _count: { _all: number } }) => {
      acc[curr.challengeId] = curr._count._all;
      return acc;
    }, {} as Record<string, number>);

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
