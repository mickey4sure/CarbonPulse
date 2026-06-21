import { Router } from "express";
import { getPrisma } from "../lib/db";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const CommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

// GET /api/discussion/channels - List all channels, lazy-seeding defaults if empty
router.get("/channels", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    let channels = await prisma.channel.findMany();

    if (channels.length === 0) {
      const defaultChannels = [
        { id: "general", name: "#general", description: "General eco discussion, tips, and achievements" },
        { id: "zero-waste", name: "#zero-waste", description: "Tips and discussion on eliminating waste and plastics" },
        { id: "transportation", name: "#transportation", description: "Car-free travel, cycling, public transit, and carpooling" },
        { id: "diet-food", name: "#diet-food", description: "Plant-based recipes and food carbon footprints" },
        { id: "energy", name: "#energy", description: "Saving electricity, heating/cooling, and green energy tips" },
      ];

      await prisma.$transaction(
        defaultChannels.map((c) =>
          prisma.channel.upsert({
            where: { id: c.id },
            update: {},
            create: c,
          })
        )
      );

      channels = await prisma.channel.findMany();
    }

    res.json(channels);
  } catch (err) {
    next(err);
  }
});

// GET /api/discussion/channels/:channelId/comments - Get comments for a specific channel
router.get("/channels/:channelId/comments", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { channelId } = req.params;
    const prisma = getPrisma();

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: "Channel not found." });

    const comments = await prisma.comment.findMany({
      where: { channelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedComments = comments.map((c: any) => {
      const isSelf = c.user.email === req.user!.email;
      const [local, domain] = c.user.email.split("@");
      const maskedEmail = local.length > 2 ? `${local.substring(0, 2)}***@${domain}` : `***@${domain}`;
      const cleanName = c.user.username ? `@${c.user.username}` : `EcoWarrior #${c.user.id * 137 % 1000}`;

      return {
        id: c.id,
        channelId: c.channelId,
        content: c.content,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          cleanName,
          maskedEmail,
          avatar: c.user.avatar,
          isSelf,
        },
      };
    });

    res.json(formattedComments);
  } catch (err) {
    next(err);
  }
});

// POST /api/discussion/channels/:channelId/comments - Add a comment to a channel
router.post("/channels/:channelId/comments", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { channelId } = req.params;
    const parsed = CommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const { content } = parsed.data;
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) return res.status(404).json({ error: "User not found." });

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: "Channel not found." });

    const comment = await prisma.comment.create({
      data: {
        channelId,
        userId: user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            email: true,
          },
        },
      },
    });

    const isSelf = true;
    const [local, domain] = comment.user.email.split("@");
    const maskedEmail = local.length > 2 ? `${local.substring(0, 2)}***@${domain}` : `***@${domain}`;
    const cleanName = comment.user.username ? `@${comment.user.username}` : `EcoWarrior #${comment.user.id * 137 % 1000}`;

    res.status(201).json({
      id: comment.id,
      channelId: comment.channelId,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        cleanName,
        maskedEmail,
        avatar: comment.user.avatar,
        isSelf,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
