import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { loginSchema, validateKeySchema, generateKeysSchema, scriptExecuteSchema, insertShowcaseSchema, insertPackageSchema, insertTeamSchema } from "@shared/schema";
import { z } from "zod";

const JWT_SECRET = process.env.SESSION_SECRET || "kingvypers-secret-key";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

interface AuthRequest extends Request {
  adminId?: number;
}

function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += chars[crypto.randomInt(chars.length)];
    }
    segments.push(segment);
  }
  return segments.join("-");
}

const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: number };
    req.adminId = decoded.adminId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
});

const keyValidationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many validation attempts, please wait" },
});

const scriptExecuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Too many script execute requests, please wait" },
});

const showcaseActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many actions, please try again later" },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api", apiLimiter);

  await ensureDefaultAdmin();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const admin = await storage.getAdminByUsername(data.username);
      
      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(data.password, admin.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, username: admin.username });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password required" });
      }

      const admin = await storage.getAdmin(req.adminId!);
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      const validPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await storage.updateAdminPassword(admin.id, newHash);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/keys", authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 20));
      const status = (req.query.status as string) || "all";
      const search = (req.query.search as string) || "";
      const offset = (page - 1) * limit;

      const [keysList, total] = await Promise.all([
        storage.getKeysPaginated(limit, offset, { status, search }),
        storage.getKeysTotal({ status, search }),
      ]);
      res.json({ keys: keysList, total });
    } catch (error) {
      console.error("Get keys error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/keys/generate", authMiddleware, async (req, res) => {
    try {
      const data = generateKeysSchema.parse(req.body);
      const generatedKeys = [];

      for (let i = 0; i < data.quantity; i++) {
        let keyCode: string;
        let exists = true;
        
        while (exists) {
          keyCode = generateKeyCode();
          const existing = await storage.getKeyByCode(keyCode);
          exists = !!existing;
        }

        const key = await storage.createKey({
          keyCode: keyCode!,
          durationMonths: data.durationMonths,
          price: data.price,
          notes: data.notes || null,
        });
        
        generatedKeys.push(key);

        await storage.createLog({
          action: "created",
          keyId: key.id,
          details: `Key generated with ${data.durationMonths} month duration`,
        });
      }

      res.json({ keys: generatedKeys });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Generate keys error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/keys/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid key ID" });
      }

      const key = await storage.getKey(id);
      if (!key) {
        return res.status(404).json({ message: "Key not found" });
      }

      await storage.deleteKey(id);
      await storage.createLog({
        action: "deleted",
        keyId: null,
        details: `Key ${key.keyCode} deleted`,
      });

      res.json({ message: "Key deleted successfully" });
    } catch (error) {
      console.error("Delete key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/keys/:id/blacklist", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid key ID" });
      }

      const key = await storage.getKey(id);
      if (!key) {
        return res.status(404).json({ message: "Key not found" });
      }

      const updated = await storage.updateKey(id, { status: "blacklisted" });
      await storage.createLog({
        action: "blacklisted",
        keyId: id,
        details: `Key ${key.keyCode} blacklisted`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Blacklist key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/keys/:id/reset", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid key ID" });
      }

      const key = await storage.getKey(id);
      if (!key) {
        return res.status(404).json({ message: "Key not found" });
      }

      const updated = await storage.updateKey(id, {
        hwid: null,
      });
      
      await storage.createLog({
        action: "reset",
        keyId: id,
        details: `Key ${key.keyCode} HWID reset`,
      });

      res.json(updated);
    } catch (error) {
      console.error("Reset key error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/validate-key", keyValidationLimiter, async (req, res) => {
    try {
      const data = validateKeySchema.parse(req.body);
      const key = await storage.getKeyByCode(data.key);

      if (!key) {
        return res.status(404).json({
          success: false,
          message: "Key not found",
        });
      }

      if (key.status === "blacklisted") {
        return res.status(403).json({
          success: false,
          message: "This key has been blacklisted",
        });
      }

      if (key.status === "expired") {
        return res.status(403).json({
          success: false,
          message: "This key has expired",
        });
      }

      if (key.status === "active") {
        if (key.hwid && key.hwid !== data.hwid) {

          return res.status(403).json({
            success: false,
            message: "This key is already bound to another device",
          });
        }

        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
          await storage.updateKey(key.id, { status: "expired" });
          return res.status(403).json({
            success: false,
            message: "This key has expired",
          });
        }

        if (data.robloxUsername != null && data.robloxUsername !== "") {
          await storage.updateKey(key.id, { robloxUsername: data.robloxUsername });
        }

        return res.json({
          success: true,
          message: "Key validated successfully",
          expiresAt: key.expiresAt,
        });
      }

      if (key.status === "unused") {
        const activatedAt = new Date();
        const expiresAt = new Date(activatedAt);
        expiresAt.setMonth(expiresAt.getMonth() + key.durationMonths);

        const updateData: { status: "active"; hwid: string; activatedAt: Date; expiresAt: Date; robloxUsername?: string } = {
          status: "active",
          hwid: data.hwid,
          activatedAt,
          expiresAt,
        };
        if (data.robloxUsername != null && data.robloxUsername !== "") {
          updateData.robloxUsername = data.robloxUsername;
        }
        await storage.updateKey(key.id, updateData);

        await storage.createLog({
          action: "activated",
          keyId: key.id,
          details: `Key activated with HWID: ${data.hwid.slice(0, 12)}...`,
        });

        return res.json({
          success: true,
          message: "Key activated successfully",
          expiresAt,
        });
      }

      res.status(400).json({
        success: false,
        message: "Unknown key status",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: error.errors[0].message,
        });
      }
      console.error("Validate key error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  app.post("/api/script-execute", scriptExecuteLimiter, async (req, res) => {
    try {
      const data = scriptExecuteSchema.parse(req.body);
      const key = await storage.getKeyByCode(data.key);
      if (!key) {
        return res.status(404).json({ success: false, message: "Key not found" });
      }
      if (key.status === "blacklisted") {
        return res.status(403).json({ success: false, message: "Key blacklisted" });
      }
      if (key.status === "expired") {
        return res.status(403).json({ success: false, message: "Key expired" });
      }
      if (key.status !== "active" && key.status !== "unused") {
        return res.status(403).json({ success: false, message: "Key not valid" });
      }
      if (key.status === "active") {
        if (key.hwid && key.hwid !== data.hwid) {
          return res.status(403).json({ success: false, message: "HWID mismatch" });
        }
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
          await storage.updateKey(key.id, { status: "expired" });
          return res.status(403).json({ success: false, message: "Key expired" });
        }
      }
      const updateData: { robloxUsername?: string } = {};
      if (data.robloxUsername != null && data.robloxUsername !== "") {
        updateData.robloxUsername = data.robloxUsername;
      }
      if (Object.keys(updateData).length > 0) {
        await storage.updateKey(key.id, updateData);
      }
      const updated = await storage.incrementKeyExecution(key.id);
      return res.json({
        success: true,
        executionCount: updated?.executionCount ?? key.executionCount + 1,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.errors[0].message });
      }
      console.error("Script execute error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/check-key/:key", keyValidationLimiter, async (req, res) => {
    try {
      const keyCode = req.params.key;
      const key = await storage.getKeyByCode(keyCode);

      if (!key) {
        return res.status(404).json({
          success: false,
          message: "Key not found",
        });
      }

      if (key.status === "active" && key.expiresAt && new Date(key.expiresAt) < new Date()) {
        await storage.updateKey(key.id, { status: "expired" });
        return res.json({
          success: true,
          status: "expired",
          expiresAt: key.expiresAt,
          hwid: key.hwid,
          hwidResetAt: key.hwidResetAt,
          message: "This key has expired",
        });
      }

      res.json({
        success: true,
        status: key.status,
        expiresAt: key.expiresAt,
        hwid: key.hwid,
        hwidResetAt: key.hwidResetAt,
        message: `Key status: ${key.status}`,
      });
    } catch (error) {
      console.error("Check key error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  const HWID_RESET_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

  app.post("/api/user-reset-hwid", keyValidationLimiter, async (req, res) => {
    try {
      const { key: keyCode } = req.body;
      if (!keyCode || typeof keyCode !== "string") {
        return res.status(400).json({
          success: false,
          message: "Key is required",
        });
      }

      const key = await storage.getKeyByCode(keyCode.trim());
      if (!key) {
        return res.status(404).json({ success: false, message: "Key not found" });
      }
      if (key.status === "blacklisted") {
        return res.status(403).json({ success: false, message: "Key is blacklisted" });
      }
      if (key.status === "expired") {
        return res.status(403).json({ success: false, message: "Key has expired" });
      }
      if (key.status === "unused") {
        return res.status(400).json({ success: false, message: "Key not activated yet, no HWID to reset" });
      }

      const now = new Date();
      const resetAt = key.hwidResetAt ? new Date(key.hwidResetAt) : null;
      const nextAllowedAt = resetAt ? new Date(resetAt.getTime() + HWID_RESET_COOLDOWN_MS) : null;
      if (nextAllowedAt && now < nextAllowedAt) {
        const minutesLeft = Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 60000);
        return res.status(429).json({
          success: false,
          message: `Bisa reset lagi dalam ${minutesLeft} menit`,
          resetAvailableAt: nextAllowedAt.toISOString(),
        });
      }

      const updated = await storage.updateKey(key.id, {
        hwid: null,
        hwidResetAt: now,
      });
      if (!updated) {
        return res.status(500).json({ success: false, message: "Failed to reset HWID" });
      }

      await storage.createLog({
        action: "reset",
        keyId: key.id,
        details: `HWID reset by user (self-service) for key ${key.keyCode}`,
      });

      return res.json({
        success: true,
        message: "HWID berhasil di-reset. Key bisa dipakai di device baru.",
        resetAvailableAt: new Date(now.getTime() + HWID_RESET_COOLDOWN_MS).toISOString(),
      });
    } catch (error) {
      console.error("User reset HWID error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // ========================
  // NEW: RESET HWID ENDPOINT (BOT)
  // ========================
  app.post("/api/reset-hwid", async (req, res) => {
    try {
      // AUTH BOT
      const authHeader = req.headers.authorization;
      const botSecret = process.env.BOT_SECRET;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const token = authHeader.split(" ")[1];
      if (!botSecret || token !== botSecret) {
        return res.status(403).json({
          success: false,
          message: "Invalid bot token",
        });
      }

      // VALIDASI BODY
      const { key } = req.body;

      if (!key) {
        return res.status(400).json({
          success: false,
          message: "Key is required",
        });
      }

      // CEK KEY
      const existingKey = await storage.getKeyByCode(key);

      if (!existingKey) {
        return res.status(404).json({
          success: false,
          message: "Key not found",
        });
      }

      if (existingKey.status === "expired") {
        return res.status(400).json({
          success: false,
          message: "Key already expired",
        });
      }

      // RESET HWID
      const updatedKey = await storage.updateKey(existingKey.id, {
        hwid: null,
        hwidResetAt: new Date(),
      });

      if (!updatedKey) {
        return res.status(500).json({
          success: false,
          message: "Failed to reset HWID",
        });
      }

      // LOG (OPTIONAL)
      await storage.createLog({
        action: "reset",
        keyId: updatedKey.id,
        details: `HWID reset via Discord bot for key ${existingKey.keyCode}`,
      });

      // RESPONSE
      return res.json({
        success: true,
        message: "HWID reset successfully",
        expiresAt: updatedKey.expiresAt,
      });
    } catch (err) {
      console.error("RESET HWID ERROR:", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  });

  app.get("/api/showcase", async (req, res) => {
    try {
      const items = await storage.getAllShowcase();
      res.json(items);
    } catch (error) {
      console.error("Showcase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/showcase", authMiddleware, async (req, res) => {
    try {
      const data = insertShowcaseSchema.parse(req.body);
      const item = await storage.createShowcase(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create showcase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/showcase/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const data = insertShowcaseSchema.partial().parse(req.body);
      const item = await storage.updateShowcase(id, data);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update showcase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/showcase/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const ok = await storage.deleteShowcase(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete showcase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/showcase/:id/view", showcaseActionLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const item = await storage.incrementShowcaseView(id);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json({ viewCount: item.viewCount });
    } catch (error) {
      console.error("Showcase view error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/showcase/:id/like", showcaseActionLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const item = await storage.incrementShowcaseLike(id);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json({ likeCount: item.likeCount });
    } catch (error) {
      console.error("Showcase like error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/showcase/:id/tip", showcaseActionLimiter, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const item = await storage.incrementShowcaseTip(id);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json({ tipCount: item.tipCount });
    } catch (error) {
      console.error("Showcase tip error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/packages", async (req, res) => {
    try {
      const items = await storage.getAllPackages();
      res.json(items);
    } catch (error) {
      console.error("Packages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/packages", authMiddleware, async (req, res) => {
    try {
      const data = insertPackageSchema.parse(req.body);
      const item = await storage.createPackage(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create package error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/packages/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const data = insertPackageSchema.partial().parse(req.body);
      const item = await storage.updatePackage(id, data);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update package error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/packages/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const ok = await storage.deletePackage(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete package error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Teams
  app.get("/api/teams", async (req, res) => {
    try {
      const items = await storage.getAllTeams();
      res.json(items);
    } catch (error) {
      console.error("Teams error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Teams. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/teams", authMiddleware, async (req, res) => {
    try {
      const data = insertTeamSchema.parse(req.body);
      const item = await storage.createTeam(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create team error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Teams. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/teams/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const data = insertTeamSchema.partial().parse(req.body);
      const item = await storage.updateTeam(id, data);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update team error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Teams. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/teams/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const ok = await storage.deleteTeam(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete team error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Teams. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/revenue/stats", authMiddleware, async (req, res) => {
    try {
      const stats = await storage.getRevenueStats();
      res.json(stats);
    } catch (error) {
      console.error("Revenue stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  return httpServer;
}

async function ensureDefaultAdmin() {
  const existingAdmin = await storage.getAdminByUsername(DEFAULT_ADMIN_USERNAME);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await storage.createAdmin({
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
    });
    console.log(`Default admin created: ${DEFAULT_ADMIN_USERNAME}`);
  }
}
