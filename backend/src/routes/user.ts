import { Router } from "express";
import { getPrisma } from "../lib/db";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

const router = Router();

// Sync Firebase User with database on login/sign-up
router.post("/", async (req, res) => {
  const { firebaseUid, email } = req.body;

  if (!firebaseUid || !email) {
    return res.status(400).json({ error: "Missing firebaseUid or email" });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.upsert({
      where: { firebaseUid },
      update: { email },
      create: { firebaseUid, email },
    });
    res.status(201).json(user);
  } catch (error) {
    console.error("Error syncing user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/users/verify - Verify if a user exists by email (for mock auth fallback check)
router.post("/verify", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({ exists: true, firebaseUid: user.firebaseUid });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/users/me - Get current user profile details
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        activities: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      firebaseUid: user.firebaseUid,
      createdAt: user.createdAt,
      tutorialCompleted: user.tutorialCompleted,
      totalActivitiesCount: user.activities.length,
      totalCo2Kg: user.activities.reduce((sum, act) => sum + act.co2Kg, 0),
      name: user.name,
      username: user.username,
      phone: user.phone,
      age: user.age,
      region: user.region,
      country: user.country,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/users/me - Update user profile details
router.put("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, username, phone, age, region, country, avatar } = req.body;
  try {
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    
    // Robustly parse age to avoid SQLite/Prisma crash if empty or non-numeric
    let parsedAge = null;
    if (age !== undefined && age !== null && age !== "") {
      const val = parseInt(age);
      if (!isNaN(val)) parsedAge = val;
    }

    const updated = await prisma.user.update({
      where: { firebaseUid },
      data: {
        name: name !== undefined ? name : undefined,
        username: username !== undefined ? username : undefined,
        phone: phone !== undefined ? phone : undefined,
        age: parsedAge,
        region: region !== undefined ? region : undefined,
        country: country !== undefined ? country : undefined,
        avatar: avatar !== undefined ? avatar : undefined,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/users/tutorial - Complete user onboarding tutorial
router.post("/tutorial", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    await prisma.user.update({
      where: { firebaseUid },
      data: { tutorialCompleted: true },
    });
    res.json({ success: true, message: "Tutorial completed successfully." });
  } catch (error) {
    console.error("Error updating user tutorial status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/users - Get all other users for public display (respecting privacy policies)
router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const firebaseUid = req.user!.uid;
    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      include: {
        activities: true,
      },
    });

    // Transform users to strip out any personally identifiable information (PII)
    // and format as masked profile cards
    const publicProfiles = users.map((user) => {
      const [local, domain] = user.email.split("@");
      const maskedEmail =
        local.length > 2
          ? `${local.substring(0, 2)}***@${domain}`
          : `***@${domain}`;

      // Use username if set, otherwise default to pseudonymous EcoWarrior name
      const cleanName = user.username ? `@${user.username}` : `EcoWarrior #${user.id * 137 % 1000}`;

      return {
        id: user.id,
        cleanName,
        maskedEmail,
        isSelf: user.firebaseUid === firebaseUid,
        totalActivities: user.activities.length,
        totalCo2Kg:
          Math.round(user.activities.reduce((sum, act) => sum + act.co2Kg, 0) * 10) / 10,
        createdAt: user.createdAt,
        region: user.region,
        country: user.country,
        avatar: user.avatar,
      };
    });

    res.json(publicProfiles);
  } catch (error) {
    console.error("Error fetching public profiles:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
