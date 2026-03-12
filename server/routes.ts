import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, HttpError } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { loginSchema, userRegisterSchema, userLoginSchema, createOrderSchema, validateKeySchema, generateKeysSchema, scriptExecuteSchema, insertShowcaseSchema, insertPackageSchema, insertTeamSchema, insertTestimonialSchema, insertGameSupportSchema } from "@shared/schema";
import { z } from "zod";
import { cashifyCheckStatus, cashifyGenerateQrisV1 } from "./cashify";

const JWT_SECRET = process.env.SESSION_SECRET || "kingvypers-secret-key";
const USER_JWT_SECRET = process.env.USER_JWT_SECRET || JWT_SECRET;
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

interface AuthRequest extends Request {
  adminId?: number;
}

interface UserAuthRequest extends Request {
  userId?: string;
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

const requireUserAuth = async (req: UserAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, USER_JWT_SECRET) as { userId: string };
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    if ((user as any).isBanned === 1) {
      return res.status(403).json({ message: "Akun dibanned", reason: (user as any).banReason ?? null });
    }
    req.userId = user.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    const url = String(req.originalUrl || "");
    if (url.startsWith("/api/user/")) return 1000;
    return 100;
  },
  skip: (req) => String(req.originalUrl || "").startsWith("/api/webhooks/cashify"),
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

  app.post("/api/webhooks/cashify", async (req, res) => {
    try {
      const secret = process.env.CASHIFY_WEBHOOK_SECRET?.trim();
      if (!secret) return res.status(500).json({ message: "Cashify webhook secret belum dikonfigurasi" });

      const header = (name: string) => {
        const v = req.headers[name.toLowerCase()];
        if (!v) return null;
        return Array.isArray(v) ? String(v[0] || "") : String(v);
      };

      const providedSecret =
        header("x-webhook-secret") ||
        header("x-cashify-webhook-secret") ||
        header("x-cashify-secret") ||
        null;

      const providedSignature =
        header("x-webhook-signature") ||
        header("x-cashify-signature") ||
        header("x-signature") ||
        null;

      const providedAuth = header("authorization");

      const safeEqual = (a: string, b: string) => {
        const ab = Buffer.from(a);
        const bb = Buffer.from(b);
        if (ab.length !== bb.length) return false;
        return crypto.timingSafeEqual(ab, bb);
      };

      const rawBody = (req as any).rawBody;
      const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(req.body ?? {}));

      let verified = false;
      if (providedSecret && safeEqual(providedSecret, secret)) verified = true;
      if (!verified && providedAuth && providedAuth.startsWith("Bearer ")) {
        const token = providedAuth.slice(7).trim();
        if (token && safeEqual(token, secret)) verified = true;
      }
      if (!verified && providedSignature) {
        const sig = providedSignature.trim().replace(/^sha256=/i, "");
        const hmacRawHex = crypto.createHmac("sha256", secret).update(rawBuffer).digest("hex");
        const hmacRawB64 = crypto.createHmac("sha256", secret).update(rawBuffer).digest("base64");
        const ts = header("x-webhook-timestamp") || header("x-timestamp");
        const rawText = rawBuffer.toString("utf8");
        const hmacTsRawHex = ts ? crypto.createHmac("sha256", secret).update(`${ts}${rawText}`).digest("hex") : null;
        const hmacTsRawB64 = ts ? crypto.createHmac("sha256", secret).update(`${ts}${rawText}`).digest("base64") : null;

        const candidates = [hmacRawHex, hmacRawB64, hmacTsRawHex, hmacTsRawB64].filter(Boolean) as string[];
        if (candidates.some((c) => safeEqual(c, sig))) verified = true;
      }

      if (!verified) return res.status(401).json({ message: "Unauthorized" });

      const payload: any = req.body ?? {};
      const txId =
        payload.transactionId ||
        payload.transaction_id ||
        payload.txId ||
        payload.tx_id ||
        payload.data?.transactionId ||
        payload.data?.transaction_id ||
        payload.data?.id ||
        null;
      const statusRaw =
        payload.status ||
        payload.transactionStatus ||
        payload.transaction_status ||
        payload.data?.status ||
        payload.data?.transactionStatus ||
        payload.data?.transaction_status ||
        null;

      if (!txId) return res.status(400).json({ message: "Missing transactionId" });
      const remoteStatus = String(statusRaw || "").toLowerCase();

      const order = await storage.getOrderByPaymentOrderId(String(txId));
      if (!order) return res.json({ message: "Webhook processed", ok: true });

      if (order.status === "paid" || order.status === "expired" || order.status === "rejected") {
        return res.json({ message: "Webhook processed", ok: true, orderId: order.id, status: order.status });
      }

      if (remoteStatus === "paid" || remoteStatus === "success") {
        try {
          const { order: updated } = await storage.autoApproveOrderAndAssignKey(order.id);
          return res.json({ message: "Webhook processed", ok: true, orderId: updated.id, status: updated.status });
        } catch (e) {
          if (e instanceof HttpError && e.status === 409) {
            const updated = await storage.updateOrder(order.id, { status: "waiting_verification" });
            return res.json({ message: "Webhook processed", ok: true, orderId: updated?.id ?? order.id, status: "waiting_verification" });
          }
          throw e;
        }
      }

      if (remoteStatus === "expired") {
        const updated = await storage.updateOrder(order.id, { status: "expired" });
        return res.json({ message: "Webhook processed", ok: true, orderId: updated?.id ?? order.id, status: "expired" });
      }

      if (remoteStatus === "cancel" || remoteStatus === "canceled" || remoteStatus === "cancelled") {
        const updated = await storage.updateOrder(order.id, { status: "rejected" });
        return res.json({ message: "Webhook processed", ok: true, orderId: updated?.id ?? order.id, status: "rejected" });
      }

      return res.json({ message: "Webhook processed", ok: true, orderId: order.id, status: order.status });
    } catch (error) {
      console.error("Cashify webhook error:", error);
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

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

  app.post("/api/user/register", async (req, res) => {
    try {
      const data = userRegisterSchema.parse(req.body);
      const email = data.email.trim().toLowerCase();
      const username = data.username.trim();

      const [existingEmail, existingUsername] = await Promise.all([
        storage.getUserByEmail(email),
        storage.getUserByUsername(username),
      ]);
      if (existingEmail) {
        return res.status(409).json({ message: "Email sudah terdaftar" });
      }
      if (existingUsername) {
        return res.status(409).json({ message: "Username sudah dipakai" });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        username,
        email,
        passwordHash,
      });

      const token = jwt.sign({ userId: user.id }, USER_JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("User register error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/login", async (req, res) => {
    try {
      const data = userLoginSchema.parse(req.body);
      const email = data.email.trim().toLowerCase();

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Email atau password salah" });
      }

      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: "Email atau password salah" });
      }

      if ((user as any).isBanned === 1) {
        return res.status(403).json({ message: "Akun dibanned", reason: (user as any).banReason ?? null });
      }

      const token = jwt.sign({ userId: user.id }, USER_JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("User login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/change-password", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password minimal 6 karakter" });
      }

      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) return res.status(401).json({ message: "Password lama salah" });

      const newHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, newHash);
      return res.json({ message: "Password berhasil diubah" });
    } catch (error) {
      console.error("User change password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/me", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json({ id: user.id, username: user.username, email: user.email, createdAt: user.createdAt });
    } catch (error) {
      console.error("User me error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/user/keys", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const rows = await storage.getKeysByUserId(req.userId!);
      const keysList = rows.map((k) => ({
        id: k.id,
        keyCode: k.keyCode,
        status: k.status,
        expiresAt: k.expiresAt,
        hwid: k.hwid,
        hwidResetAt: k.hwidResetAt,
        orderId: k.orderId,
        packageTitle: k.order?.package?.title ?? null,
        orderStatus: k.order?.status ?? null,
        price: k.price,
        createdAt: k.createdAt,
      }));
      return res.json({ keys: keysList });
    } catch (error) {
      console.error("User keys error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/keys/:id/reset-hwid", requireUserAuth, keyValidationLimiter, async (req: UserAuthRequest, res) => {
    try {
      const id = parseInt(String(req.params.id || ""));
      if (isNaN(id)) return res.status(400).json({ success: false, message: "Invalid key ID" });

      const key = await storage.getKey(id);
      if (!key) return res.status(404).json({ success: false, message: "Key not found" });
      if (key.userId !== req.userId) return res.status(403).json({ success: false, message: "Forbidden" });
      if (key.status === "blacklisted") return res.status(403).json({ success: false, message: "Key is blacklisted" });
      if (key.status === "expired") return res.status(403).json({ success: false, message: "Key has expired" });
      if (key.status !== "active" || !key.hwid) {
        return res.status(400).json({ success: false, message: "Key belum aktif, tidak ada HWID untuk di-reset" });
      }

      const HWID_RESET_COOLDOWN_MS = 20 * 60 * 1000;
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
      if (!updated) return res.status(500).json({ success: false, message: "Failed to reset HWID" });

      await storage.createLog({
        action: "reset",
        keyId: key.id,
        details: `HWID reset by user dashboard for key ${key.keyCode}`,
      });

      return res.json({
        success: true,
        message: "HWID berhasil di-reset. Key bisa dipakai di device baru.",
        resetAvailableAt: new Date(now.getTime() + HWID_RESET_COOLDOWN_MS).toISOString(),
      });
    } catch (error) {
      console.error("User reset HWID (auth) error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/user/orders", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const ordersList = await storage.getOrdersByUserId(req.userId!);
      const payload = ordersList.map((o) => ({
        id: o.id,
        packageId: o.packageId,
        packageTitle: o.package?.title ?? null,
        price: o.price,
        status: o.status,
        createdAt: o.createdAt,
        payment: o.paymentProvider
          ? {
              provider: o.paymentProvider,
              orderId: o.paymentOrderId,
              linkCode: o.paymentLinkCode,
              url: o.paymentLinkUrl,
              qrString: o.paymentQrString,
              originalAmount: o.paymentOriginalAmount,
              totalAmount: o.paymentTotalAmount,
              uniqueNominal: o.paymentUniqueNominal,
              expiresAt: o.paymentExpiresAt,
            }
          : null,
      }));
      return res.json({ orders: payload });
    } catch (error) {
      console.error("User orders error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/orders", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const data = createOrderSchema.parse(req.body);
      const pkg = await storage.getPackage(data.packageId);
      if (!pkg) return res.status(404).json({ message: "Package not found" });

      const existing = await storage.getOrdersByUserId(req.userId!);
      const activeExisting = existing.find((o) => o.status === "pending");
      if (activeExisting) {
        return res.status(409).json({
          message: "Masih ada order aktif yang belum selesai. Selesaikan atau batalkan sebelum membuat order baru.",
          activeOrderId: activeExisting.id,
          activeStatus: activeExisting.status,
        });
      }

      const order = await storage.createOrder({
        userId: req.userId!,
        packageId: pkg.id,
        price: String(pkg.price),
        status: "pending",
      });

      const qrisId = process.env.CASHIFY_QRIS_ID?.trim();
      if (!qrisId) return res.status(500).json({ message: "Cashify belum dikonfigurasi: CASHIFY_QRIS_ID kosong" });

      const packageIds = String(process.env.CASHIFY_PACKAGE_IDS || "id.dana")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (packageIds.length === 0) return res.status(500).json({ message: "Cashify belum dikonfigurasi: CASHIFY_PACKAGE_IDS kosong" });
      const invalidPackageId = packageIds.find((id) => !id.includes(".") || /\s/.test(id));
      if (invalidPackageId) {
        return res.status(500).json({
          message: `CASHIFY_PACKAGE_IDS tidak valid ('${invalidPackageId}'). Harus android package name, contoh: id.dana, id.ovo, com.shopee.id`,
        });
      }

      const expiredInMinutes = Math.max(1, parseInt(String(process.env.CASHIFY_EXPIRED_MINUTES || "15")) || 15);
      const useUniqueCode = String(process.env.CASHIFY_USE_UNIQUE_CODE || "true").toLowerCase() !== "false";
      const amount = Math.max(0, Math.round(parseFloat(String(pkg.price)) || 0));

      const payment = await cashifyGenerateQrisV1({
        qrisId,
        amount,
        useUniqueCode,
        packageIds,
        expiredInMinutes,
      });

      const expiresAt = new Date(Date.now() + expiredInMinutes * 60_000);
      await storage.updateOrder(order.id, {
        paymentProvider: "cashify",
        paymentOrderId: payment.transactionId,
        paymentLinkCode: null,
        paymentLinkUrl: null,
        paymentQrString: payment.qr_string,
        paymentOriginalAmount: Math.round(payment.originalAmount || amount),
        paymentTotalAmount: Math.round(payment.totalAmount || amount),
        paymentUniqueNominal: payment.uniqueNominal ? Math.round(payment.uniqueNominal) : null,
        paymentExpiresAt: expiresAt,
      });

      return res.status(201).json({
        orderId: order.id,
        status: order.status,
        package: {
          id: pkg.id,
          title: pkg.title,
          durationDays: pkg.durationDays,
          price: String(pkg.price),
          buyLink: "",
        },
        payment: {
          provider: "cashify",
          orderId: payment.transactionId,
          linkCode: null,
          url: null,
          expiresAt: expiresAt.toISOString(),
          qrString: payment.qr_string,
          originalAmount: Math.round(payment.originalAmount || amount),
          totalAmount: Math.round(payment.totalAmount || amount),
          uniqueNominal: payment.uniqueNominal ? Math.round(payment.uniqueNominal) : null,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("User create order error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/orders/:id/confirm", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== req.userId) return res.status(403).json({ message: "Forbidden" });
      if (order.status !== "pending" && order.status !== "waiting_verification") {
        return res.status(400).json({ message: `Order tidak bisa dicek dari status '${order.status}'` });
      }
      if (order.paymentProvider !== "cashify" || !order.paymentOrderId) {
        return res.status(400).json({ message: "Order ini belum punya transaksi Cashify" });
      }

      const remote = await cashifyCheckStatus(order.paymentOrderId);
      const remoteStatus = String(remote.status || "").toLowerCase();
      if (remoteStatus === "paid" || remoteStatus === "success") {
        try {
          const { order: updated, key } = await storage.autoApproveOrderAndAssignKey(order.id);
          return res.json({
            id: updated.id,
            status: updated.status,
            key: { id: key.id, keyCode: key.keyCode, status: key.status },
            gateway: { ok: true, message: "Pembayaran terdeteksi, key otomatis dikirim", remoteStatus },
          });
        } catch (e) {
          if (e instanceof HttpError && e.status === 409) {
            await storage.updateOrder(order.id, { status: "waiting_verification" });
            return res.json({
              id: order.id,
              status: "waiting_verification",
              gateway: { ok: true, message: "Pembayaran terdeteksi, tapi stok paket sedang kosong. Admin akan proses manual.", remoteStatus },
            });
          }
          throw e;
        }
      }
      if (remoteStatus === "expired") {
        const updated = await storage.updateOrder(order.id, { status: "expired" });
        return res.json({
          id: updated?.id ?? order.id,
          status: updated?.status ?? "expired",
          gateway: { ok: false, message: "Transaksi expired", remoteStatus },
        });
      }
      if (remoteStatus === "cancel" || remoteStatus === "canceled" || remoteStatus === "cancelled") {
        const updated = await storage.updateOrder(order.id, { status: "rejected" });
        return res.json({
          id: updated?.id ?? order.id,
          status: updated?.status ?? "rejected",
          gateway: { ok: false, message: "Transaksi dibatalkan", remoteStatus },
        });
      }

      return res.json({
        id: order.id,
        status: order.status,
        gateway: { ok: false, message: "Belum terdeteksi pembayaran (masih pending)", remoteStatus },
      });
    } catch (error) {
      console.error("User confirm payment error:", error);
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/user/orders/:id/payment-link", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== req.userId) return res.status(403).json({ message: "Forbidden" });
      if (order.status !== "pending") return res.status(400).json({ message: "Payment link hanya bisa dibuat saat status pending" });
      const qrisId = process.env.CASHIFY_QRIS_ID?.trim();
      if (!qrisId) return res.status(500).json({ message: "Cashify belum dikonfigurasi: CASHIFY_QRIS_ID kosong" });

      const packageIds = String(process.env.CASHIFY_PACKAGE_IDS || "id.dana")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (packageIds.length === 0) return res.status(500).json({ message: "Cashify belum dikonfigurasi: CASHIFY_PACKAGE_IDS kosong" });
      const invalidPackageId = packageIds.find((id) => !id.includes(".") || /\s/.test(id));
      if (invalidPackageId) {
        return res.status(500).json({
          message: `CASHIFY_PACKAGE_IDS tidak valid ('${invalidPackageId}'). Harus android package name, contoh: id.dana, id.ovo, com.shopee.id`,
        });
      }

      const expiredInMinutes = Math.max(1, parseInt(String(process.env.CASHIFY_EXPIRED_MINUTES || "15")) || 15);
      const useUniqueCode = String(process.env.CASHIFY_USE_UNIQUE_CODE || "true").toLowerCase() !== "false";
      const amount = Math.max(0, Math.round(parseFloat(String(order.price)) || 0));

      const payment = await cashifyGenerateQrisV1({
        qrisId,
        amount,
        useUniqueCode,
        packageIds,
        expiredInMinutes,
      });

      const expiresAt = new Date(Date.now() + expiredInMinutes * 60_000);
      await storage.updateOrder(order.id, {
        paymentProvider: "cashify",
        paymentOrderId: payment.transactionId,
        paymentLinkCode: null,
        paymentLinkUrl: null,
        paymentQrString: payment.qr_string,
        paymentOriginalAmount: Math.round(payment.originalAmount || amount),
        paymentTotalAmount: Math.round(payment.totalAmount || amount),
        paymentUniqueNominal: payment.uniqueNominal ? Math.round(payment.uniqueNominal) : null,
        paymentExpiresAt: expiresAt,
      });

      return res.json({
        orderId: order.id,
        status: order.status,
        payment: {
          provider: "cashify",
          orderId: payment.transactionId,
          linkCode: null,
          url: null,
          expiresAt: expiresAt.toISOString(),
          qrString: payment.qr_string,
          originalAmount: Math.round(payment.originalAmount || amount),
          totalAmount: Math.round(payment.totalAmount || amount),
          uniqueNominal: payment.uniqueNominal ? Math.round(payment.uniqueNominal) : null,
        },
      });
    } catch (error) {
      console.error("User create payment link error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/user/orders/:id/cancel", requireUserAuth, async (req: UserAuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.userId !== req.userId) return res.status(403).json({ message: "Forbidden" });
      if (order.status !== "pending") {
        return res.status(400).json({ message: `Order tidak bisa dibatalkan dari status '${order.status}'` });
      }
      const updated = await storage.updateOrder(order.id, {
        status: "rejected",
        paymentProvider: null,
        paymentOrderId: null,
        paymentLinkCode: null,
        paymentLinkUrl: null,
        paymentQrString: null,
        paymentOriginalAmount: null as any,
        paymentTotalAmount: null as any,
        paymentUniqueNominal: null as any,
        paymentExpiresAt: null as any,
      });
      return res.json({ id: updated?.id ?? order.id, status: updated?.status ?? "rejected" });
    } catch (error) {
      console.error("User cancel order error:", error);
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app.get("/api/admin/users", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20")) || 20));
      const offset = Math.max(0, parseInt(String(req.query.offset ?? "0")) || 0);
      const search = String(req.query.search ?? "").trim();

      const [items, total] = await Promise.all([
        storage.getUsersPaginated(limit, offset, { search }),
        storage.getUsersTotal({ search }),
      ]);

      return res.json({
        items: items.map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          createdAt: u.createdAt,
          warningCount: (u as any).warningCount ?? 0,
          lastWarningAt: (u as any).lastWarningAt ?? null,
          isBanned: (u as any).isBanned ?? 0,
          bannedAt: (u as any).bannedAt ?? null,
          banReason: (u as any).banReason ?? null,
        })),
        total,
      });
    } catch (error) {
      console.error("Admin get users error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/warn", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const updated = await storage.warnUser(id);
      if (!updated) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: updated.id,
        warningCount: (updated as any).warningCount ?? 0,
        lastWarningAt: (updated as any).lastWarningAt ?? null,
      });
    } catch (error) {
      console.error("Admin warn user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/ban", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const reason = req.body?.reason ? String(req.body.reason) : null;
      const updated = await storage.banUser(id, reason);
      if (!updated) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: updated.id,
        isBanned: (updated as any).isBanned ?? 0,
        bannedAt: (updated as any).bannedAt ?? null,
        banReason: (updated as any).banReason ?? null,
      });
    } catch (error) {
      console.error("Admin ban user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/users/:id/unban", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const updated = await storage.unbanUser(id);
      if (!updated) return res.status(404).json({ message: "User not found" });
      return res.json({
        id: updated.id,
        isBanned: (updated as any).isBanned ?? 0,
        bannedAt: (updated as any).bannedAt ?? null,
        banReason: (updated as any).banReason ?? null,
      });
    } catch (error) {
      console.error("Admin unban user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const ok = await storage.deleteUser(id);
      if (!ok) return res.status(404).json({ message: "User not found" });
      return res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Admin delete user error:", error);
      const code = (error as any)?.code;
      if (code === "23503") {
        return res.status(409).json({ message: "User tidak bisa dihapus karena masih punya order/data terkait. Solusi: ban user atau hapus data terkait dulu." });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/orders", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const status = String(req.query.status || "all");
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      const rows = wantsPagination
        ? await storage.getOrdersPaginated(
            Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20)),
            Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0),
            { status },
          )
        : await storage.getAllOrders();
      return res.json({
        orders: rows.map((o) => ({
          id: o.id,
          status: o.status,
          price: o.price,
          createdAt: o.createdAt,
          user: o.user ? { id: o.user.id, username: o.user.username, email: o.user.email } : null,
          package: o.package ? { id: o.package.id, title: o.package.title } : null,
          payment: o.paymentProvider
            ? {
                provider: o.paymentProvider,
                orderId: o.paymentOrderId,
                linkCode: o.paymentLinkCode,
                url: o.paymentLinkUrl,
                qrString: o.paymentQrString,
                originalAmount: o.paymentOriginalAmount,
                totalAmount: o.paymentTotalAmount,
                uniqueNominal: o.paymentUniqueNominal,
                expiresAt: o.paymentExpiresAt,
              }
            : null,
        })),
        ...(wantsPagination ? { total: await storage.getOrdersTotal({ status }) } : {}),
      });
    } catch (error) {
      console.error("Admin get orders error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/orders/:id/approve", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const keyCodeRaw = req.body?.keyCode;
      const keyCode = keyCodeRaw != null ? String(keyCodeRaw).trim() : "";
      const { order, key } = keyCode
        ? await storage.approveOrderAndAssignKeyByCode(id, keyCode)
        : await storage.approveOrderAndAssignKey(id);
      const gateway = null as null | { ok: boolean; message?: string };
      return res.json({
        orderId: order.id,
        status: order.status,
        key: { id: key.id, keyCode: key.keyCode, status: key.status },
        gateway,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Admin approve order error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/orders/:id/reject", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const updated = await storage.rejectOrder(id);
      return res.json({ orderId: updated.id, status: updated.status });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }
      console.error("Admin reject order error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/orders/:id/reset-payment", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id || "");
      const order = await storage.getOrder(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending") {
        return res.status(400).json({ message: "Reset payment hanya bisa untuk order status pending" });
      }
      const updated = await storage.updateOrder(id, {
        paymentProvider: null,
        paymentOrderId: null,
        paymentLinkCode: null,
        paymentLinkUrl: null,
        paymentQrString: null,
        paymentOriginalAmount: null,
        paymentTotalAmount: null,
        paymentUniqueNominal: null,
        paymentExpiresAt: null,
      });
      return res.json({ orderId: updated?.id ?? id, status: updated?.status ?? "pending" });
    } catch (error) {
      console.error("Admin reset payment error:", error);
      return res.status(500).json({ message: "Internal server error" });
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
          ...(data.packageId !== undefined ? { packageId: data.packageId } : {}),
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

      if (key.status === "unused" || key.status === "available" || key.status === "sold") {
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
      if (key.status !== "active" && key.status !== "available" && key.status !== "sold" && key.status !== "unused") {
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
      if (key.status !== "active" || !key.hwid) {
        return res.status(400).json({ success: false, message: "Key belum aktif, tidak ada HWID untuk di-reset" });
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
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      if (wantsPagination) {
        const limit = Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20));
        const offset = Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0);
        const [items, total] = await Promise.all([
          storage.getShowcasePaginated(limit, offset),
          storage.getShowcaseTotal(),
        ]);
        return res.json({ items, total });
      }
      const items = await storage.getAllShowcase();
      return res.json(items);
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
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      if (wantsPagination) {
        const limit = Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20));
        const offset = Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0);
        const [items, total] = await Promise.all([
          storage.getPackagesPaginated(limit, offset),
          storage.getPackagesTotal(),
        ]);
        return res.json({ items, total });
      }
      const items = await storage.getAllPackages();
      return res.json(items);
    } catch (error) {
      console.error("Packages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stocks/packages", async (req, res) => {
    try {
      const items = await storage.getPackageStocks();
      return res.json({ items });
    } catch (error) {
      console.error("Package stocks error:", error);
      return res.status(500).json({ message: "Internal server error" });
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
      const code = (error as any)?.code;
      if (code === "23503") {
        return res.status(409).json({
          message: "Tidak bisa hapus paket karena sudah dipakai oleh order/key. Solusi: buat paket baru atau kosongkan stok & pastikan tidak ada order yang refer ke paket ini.",
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Teams
  app.get("/api/teams", async (req, res) => {
    try {
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      if (wantsPagination) {
        const limit = Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20));
        const offset = Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0);
        const [items, total] = await Promise.all([
          storage.getTeamsPaginated(limit, offset),
          storage.getTeamsTotal(),
        ]);
        return res.json({ items, total });
      }
      const items = await storage.getAllTeams();
      return res.json(items);
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

  // Testimonials
  app.get("/api/testimonials", async (req, res) => {
    try {
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      if (wantsPagination) {
        const limit = Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20));
        const offset = Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0);
        const [items, total] = await Promise.all([
          storage.getTestimonialsPaginated(limit, offset),
          storage.getTestimonialsTotal(),
        ]);
        return res.json({ items, total });
      }
      const items = await storage.getAllTestimonials();
      return res.json(items);
    } catch (error) {
      console.error("Testimonials error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Testimonials. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/testimonials", authMiddleware, async (req, res) => {
    try {
      const data = insertTestimonialSchema.parse(req.body);
      const safe = {
        ...data,
        rating: Math.max(1, Math.min(5, Number((data as any).rating ?? 5))),
      };
      const item = await storage.createTestimonial(safe);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create testimonial error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Testimonials. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/testimonials/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const data = insertTestimonialSchema.partial().parse(req.body);
      const safe = {
        ...data,
        rating: data.rating === undefined ? undefined : Math.max(1, Math.min(5, Number(data.rating))),
      };
      const item = await storage.updateTestimonial(id, safe);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update testimonial error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Testimonials. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/testimonials/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const ok = await storage.deleteTestimonial(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete testimonial error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Testimonials. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Game Support
  app.get("/api/game-support", async (req, res) => {
    try {
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const wantsPagination = limitRaw !== undefined || offsetRaw !== undefined;
      if (wantsPagination) {
        const limit = Math.min(100, Math.max(1, parseInt(String(limitRaw ?? "20")) || 20));
        const offset = Math.max(0, parseInt(String(offsetRaw ?? "0")) || 0);
        const [items, total] = await Promise.all([
          storage.getGameSupportPaginated(limit, offset),
          storage.getGameSupportTotal(),
        ]);
        return res.json({ items, total });
      }
      const items = await storage.getAllGameSupport();
      return res.json(items);
    } catch (error) {
      console.error("Game support error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Game Support. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/game-support", authMiddleware, async (req, res) => {
    try {
      const data = insertGameSupportSchema.parse(req.body);
      const payload: any = {
        gameName: data.gameName,
        logoUrl: data.logoUrl,
        sortOrder: data.sortOrder,
      };
      if (data.status) payload.status = data.status;
      const item = await storage.createGameSupport(payload);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create game support error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Game Support. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/game-support/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const data = insertGameSupportSchema.partial().parse(req.body);
      const patch: any = { ...data };
      if (patch.status === undefined) delete patch.status;
      const item = await storage.updateGameSupport(id, patch);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Update game support error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Game Support. Jalankan npm run db:push." });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/game-support/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const ok = await storage.deleteGameSupport(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted" });
    } catch (error) {
      console.error("Delete game support error:", error);
      const code = (error as any)?.code;
      if (code === "42P01" || code === "42703") {
        return res.status(500).json({ message: "Database belum di-update untuk fitur Game Support. Jalankan npm run db:push." });
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
