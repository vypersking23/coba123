import {
  admins,
  users,
  orders,
  keys,
  logs,
  showcase,
  packages,
  teams,
  testimonials,
  gameSupport,
  type Admin,
  type InsertAdmin,
  type User,
  type InsertUser,
  type Order,
  type InsertOrder,
  type Key,
  type InsertKey,
  type Log,
  type InsertLog,
  type Showcase,
  type InsertShowcase,
  type Package,
  type InsertPackage,
  type Team,
  type InsertTeam,
  type Testimonial,
  type InsertTestimonial,
  type GameSupport,
  type InsertGameSupport,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, gte, and, sql, like, or, isNull } from "drizzle-orm";

export interface IStorage {
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  updateAdminPassword(id: number, passwordHash: string): Promise<Admin | undefined>;

  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  getUsersPaginated(limit: number, offset: number, filters?: { search?: string }): Promise<User[]>;
  getUsersTotal(filters?: { search?: string }): Promise<number>;
  warnUser(id: string): Promise<User | undefined>;
  banUser(id: string, reason?: string | null): Promise<User | undefined>;
  unbanUser(id: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByPaymentOrderId(paymentOrderId: string): Promise<Order | undefined>;
  updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined>;
  getOrdersByUserId(userId: string): Promise<(Order & { package?: Package })[]>;
  getAllOrders(): Promise<(Order & { user?: User; package?: Package })[]>;
  getOrdersPaginated(limit: number, offset: number, filters?: { status?: string }): Promise<(Order & { user?: User; package?: Package })[]>;
  getOrdersTotal(filters?: { status?: string }): Promise<number>;

  getAllKeys(): Promise<Key[]>;
  getKeysPaginated(limit: number, offset: number, filters?: { status?: string; search?: string }): Promise<Key[]>;
  getKeysTotal(filters?: { status?: string; search?: string }): Promise<number>;
  getKey(id: number): Promise<Key | undefined>;
  getKeyByCode(keyCode: string): Promise<Key | undefined>;
  createKey(key: InsertKey & { keyCode: string }): Promise<Key>;
  createKeys(keysData: (InsertKey & { keyCode: string })[]): Promise<Key[]>;
  updateKey(id: number, data: Partial<Key>): Promise<Key | undefined>;
  claimAvailableKey(id: number, data: Partial<Key>): Promise<Key | undefined>;
  deleteKey(id: number): Promise<boolean>;
  incrementKeyExecution(id: number): Promise<Key | undefined>;
  getKeysByUserId(userId: string): Promise<(Key & { order?: Order & { package?: Package } })[]>;
  getAvailableKeyForOrder(params: { packageId: number; price: string; durationMonths: number }): Promise<Key | undefined>;
  approveOrderAndAssignKey(orderId: string): Promise<{ order: Order; key: Key }>;
  approveOrderAndAssignKeyByCode(orderId: string, keyCode: string): Promise<{ order: Order; key: Key }>;
  autoApproveOrderAndAssignKey(orderId: string): Promise<{ order: Order; key: Key }>;
  rejectOrder(orderId: string): Promise<Order>;

  createLog(log: InsertLog): Promise<Log>;
  getRecentLogs(limit: number): Promise<(Log & { key?: Key })[]>;

  getDashboardStats(): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    unusedKeys: number;
    totalRevenue: string;
    recentActivations: (Log & { key?: Key })[];
    chartData: { date: string; activations: number }[];
  }>;

  getRevenueStats(): Promise<{
    totalRevenue: string;
    monthlyRevenue: string;
    weeklyRevenue: string;
    todayRevenue: string;
    revenueByDuration: { duration: string; revenue: number; count: number }[];
    transactions: {
      id: number;
      keyCode: string;
      price: string;
      durationMonths: number;
      createdAt: string;
    }[];
  }>;

  updateExpiredKeys(): Promise<void>;

  resetKeyHwid(keyCode: string): Promise<Key | undefined>;

  getAllShowcase(): Promise<Showcase[]>;
  getShowcasePaginated(limit: number, offset: number): Promise<Showcase[]>;
  getShowcaseTotal(): Promise<number>;
  getShowcase(id: number): Promise<Showcase | undefined>;
  createShowcase(data: InsertShowcase): Promise<Showcase>;
  updateShowcase(id: number, data: Partial<Showcase>): Promise<Showcase | undefined>;
  deleteShowcase(id: number): Promise<boolean>;
  incrementShowcaseView(id: number): Promise<Showcase | undefined>;
  incrementShowcaseLike(id: number): Promise<Showcase | undefined>;
  incrementShowcaseTip(id: number): Promise<Showcase | undefined>;

  getAllPackages(): Promise<Package[]>;
  getPackagesPaginated(limit: number, offset: number): Promise<Package[]>;
  getPackagesTotal(): Promise<number>;
  getPackageStocks(): Promise<Array<{ id: number; title: string; durationDays: number; price: string; exactAvailable: number; genericAvailable: number; totalAvailable: number }>>;
  getPackage(id: number): Promise<Package | undefined>;
  createPackage(data: InsertPackage): Promise<Package>;
  updatePackage(id: number, data: Partial<Package>): Promise<Package | undefined>;
  deletePackage(id: number): Promise<boolean>;

  getAllTeams(): Promise<Team[]>;
  getTeamsPaginated(limit: number, offset: number): Promise<Team[]>;
  getTeamsTotal(): Promise<number>;
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(data: InsertTeam): Promise<Team>;
  updateTeam(id: number, data: Partial<Team>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;

  getAllTestimonials(): Promise<Testimonial[]>;
  getTestimonialsPaginated(limit: number, offset: number): Promise<Testimonial[]>;
  getTestimonialsTotal(): Promise<number>;
  getTestimonial(id: number): Promise<Testimonial | undefined>;
  createTestimonial(data: InsertTestimonial): Promise<Testimonial>;
  updateTestimonial(id: number, data: Partial<Testimonial>): Promise<Testimonial | undefined>;
  deleteTestimonial(id: number): Promise<boolean>;

  getAllGameSupport(): Promise<GameSupport[]>;
  getGameSupportPaginated(limit: number, offset: number): Promise<GameSupport[]>;
  getGameSupportTotal(): Promise<number>;
  getGameSupport(id: number): Promise<GameSupport | undefined>;
  createGameSupport(data: InsertGameSupport): Promise<GameSupport>;
  updateGameSupport(id: number, data: Partial<GameSupport>): Promise<GameSupport | undefined>;
  deleteGameSupport(id: number): Promise<boolean>;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class DatabaseStorage implements IStorage {
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [created] = await db.insert(admins).values(admin).returning();
    return created;
  }

  async updateAdminPassword(
    id: number,
    passwordHash: string
  ): Promise<Admin | undefined> {
    const [updated] = await db
      .update(admins)
      .set({ passwordHash })
      .where(eq(admins.id, id))
      .returning();
    return updated || undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  private buildUsersFilter(filters?: { search?: string }) {
    const conditions = [];
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(or(like(users.username, term), like(users.email, term))!);
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  async getUsersPaginated(limit: number, offset: number, filters?: { search?: string }): Promise<User[]> {
    const where = this.buildUsersFilter(filters);
    const base = db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    return where ? base.where(where) : base;
  }

  async getUsersTotal(filters?: { search?: string }): Promise<number> {
    const where = this.buildUsersFilter(filters);
    const query = db.select({ count: sql<number>`count(*)::int` }).from(users);
    const result = where ? await query.where(where) : await query;
    return result[0]?.count ?? 0;
  }

  async warnUser(id: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ warningCount: sql`${users.warningCount} + 1`, lastWarningAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async banUser(id: string, reason?: string | null): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ isBanned: 1, bannedAt: new Date(), banReason: reason ?? null })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async unbanUser(id: string): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ isBanned: 0, bannedAt: null, banReason: null })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByPaymentOrderId(paymentOrderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.paymentOrderId, paymentOrderId));
    return order || undefined;
  }

  async updateOrder(id: string, data: Partial<Order>): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set(data).where(eq(orders.id, id)).returning();
    return updated || undefined;
  }

  async getOrdersByUserId(userId: string): Promise<(Order & { package?: Package })[]> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(packages, eq(orders.packageId, packages.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    return result.map((row) => ({
      ...row.orders,
      package: row.packages || undefined,
    }));
  }

  async getAllOrders(): Promise<(Order & { user?: User; package?: Package })[]> {
    const result = await db
      .select()
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(packages, eq(orders.packageId, packages.id))
      .orderBy(desc(orders.createdAt));

    return result.map((row) => ({
      ...row.orders,
      user: row.users || undefined,
      package: row.packages || undefined,
    }));
  }

  private buildOrdersFilter(filters?: { status?: string }) {
    const conditions = [];
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(orders.status, filters.status as Order["status"]));
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  async getOrdersPaginated(limit: number, offset: number, filters?: { status?: string }): Promise<(Order & { user?: User; package?: Package })[]> {
    const where = this.buildOrdersFilter(filters);
    const base = db
      .select()
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .leftJoin(packages, eq(orders.packageId, packages.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);
    const result = where ? await base.where(where) : await base;
    return result.map((row) => ({
      ...row.orders,
      user: row.users || undefined,
      package: row.packages || undefined,
    }));
  }

  async getOrdersTotal(filters?: { status?: string }): Promise<number> {
    const where = this.buildOrdersFilter(filters);
    const query = db.select({ count: sql<number>`count(*)::int` }).from(orders);
    const result = where ? await query.where(where) : await query;
    return result[0]?.count ?? 0;
  }

  async getAllKeys(): Promise<Key[]> {
    return db.select().from(keys).orderBy(desc(keys.createdAt));
  }

  private buildKeysFilter(filters?: { status?: string; search?: string }) {
    const conditions = [];
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(keys.status, filters.status as Key["status"]));
    }
    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          like(keys.keyCode, term),
          like(keys.notes, term),
          like(keys.robloxUsername, term)
        )!
      );
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  async getKeysPaginated(
    limit: number,
    offset: number,
    filters?: { status?: string; search?: string }
  ): Promise<Key[]> {
    const where = this.buildKeysFilter(filters);
    const query = db
      .select()
      .from(keys)
      .orderBy(desc(keys.createdAt))
      .limit(limit)
      .offset(offset);
    if (where) {
      return query.where(where);
    }
    return query;
  }

  async getKeysTotal(filters?: { status?: string; search?: string }): Promise<number> {
    const where = this.buildKeysFilter(filters);
    const query = db.select({ count: sql<number>`count(*)::int` }).from(keys);
    const result = where ? await query.where(where) : await query;
    return result[0]?.count ?? 0;
  }

  async getKey(id: number): Promise<Key | undefined> {
    const [key] = await db.select().from(keys).where(eq(keys.id, id));
    return key || undefined;
  }

  async getKeyByCode(keyCode: string): Promise<Key | undefined> {
    const [key] = await db
      .select()
      .from(keys)
      .where(eq(keys.keyCode, keyCode));
    return key || undefined;
  }

  async createKey(keyData: InsertKey & { keyCode: string }): Promise<Key> {
    const [created] = await db.insert(keys).values(keyData).returning();
    return created;
  }

  async createKeys(
    keysData: (InsertKey & { keyCode: string })[]
  ): Promise<Key[]> {
    if (keysData.length === 0) return [];
    return db.insert(keys).values(keysData).returning();
  }

  async updateKey(id: number, data: Partial<Key>): Promise<Key | undefined> {
    const [updated] = await db
      .update(keys)
      .set(data)
      .where(eq(keys.id, id))
      .returning();
    return updated || undefined;
  }

  async claimAvailableKey(id: number, data: Partial<Key>): Promise<Key | undefined> {
    const [updated] = await db
      .update(keys)
      .set(data)
      .where(and(eq(keys.id, id), eq(keys.status, "available")))
      .returning();
    return updated || undefined;
  }

  async incrementKeyExecution(id: number): Promise<Key | undefined> {
    const [updated] = await db
      .update(keys)
      .set({ executionCount: sql`${keys.executionCount} + 1` })
      .where(eq(keys.id, id))
      .returning();
    return updated || undefined;
  }

  async getKeysByUserId(userId: string): Promise<(Key & { order?: Order & { package?: Package } })[]> {
    const result = await db
      .select()
      .from(keys)
      .leftJoin(orders, eq(keys.orderId, orders.id))
      .leftJoin(packages, eq(orders.packageId, packages.id))
      .where(eq(keys.userId, userId))
      .orderBy(desc(keys.createdAt));

    return result.map((row) => ({
      ...row.keys,
      order: row.orders
        ? {
            ...row.orders,
            package: row.packages || undefined,
          }
        : undefined,
    }));
  }

  async getAvailableKeyForOrder(params: { packageId: number; price: string; durationMonths: number }): Promise<Key | undefined> {
    const [exact] = await db
      .select()
      .from(keys)
      .where(
        and(
          eq(keys.status, "available"),
          eq(keys.packageId, params.packageId),
        ),
      )
      .orderBy(asc(keys.id))
      .limit(1);

    if (exact) return exact;

    const [fallback] = await db
      .select()
      .from(keys)
      .where(
        and(
          eq(keys.status, "available"),
          isNull(keys.packageId),
          eq(keys.durationMonths, params.durationMonths),
          eq(keys.price, params.price),
        ),
      )
      .orderBy(asc(keys.id))
      .limit(1);

    return fallback || undefined;
  }

  async approveOrderAndAssignKey(orderId: string): Promise<{ order: Order; key: Key }> {
    return db.transaction(async (tx) => {
      const orderLock = await tx.execute<{ id: string; user_id: string; package_id: number; price: string; status: string }>(
        sql`select id, user_id, package_id, price, status from orders where id = ${orderId} for update`,
      );

      const locked = orderLock.rows[0];

      if (!locked) throw new HttpError(404, "Order not found");
      if (locked.status !== "waiting_verification") {
        throw new HttpError(400, `Order status must be waiting_verification (current: ${locked.status})`);
      }

      const [pkg] = await tx.select().from(packages).where(eq(packages.id, locked.package_id));
      if (!pkg) throw new HttpError(404, "Package not found");

      const durationMonths = Math.max(1, Math.ceil((pkg.durationDays || 30) / 30));

      const exactKey = await tx.execute<{ id: number }>(
        sql`select id from keys where status = 'available' and package_id = ${locked.package_id} order by id asc limit 1 for update skip locked`,
      );
      const exactId = exactKey.rows[0]?.id;

      const fallbackKey = exactId
        ? null
        : await tx.execute<{ id: number }>(
            sql`select id from keys where status = 'available' and package_id is null and duration_months = ${durationMonths} and price = ${locked.price} order by id asc limit 1 for update skip locked`,
          );
      const fallbackId = fallbackKey ? fallbackKey.rows[0]?.id : undefined;

      const selectedId = exactId ?? fallbackId;
      if (!selectedId) throw new HttpError(409, "Stock kosong untuk paket ini");

      const [claimed] = await tx
        .update(keys)
        .set({
          status: "sold",
          userId: locked.user_id,
          orderId: locked.id,
          packageId: locked.package_id,
        })
        .where(and(eq(keys.id, selectedId), eq(keys.status, "available")))
        .returning();

      if (!claimed) throw new HttpError(409, "Key sudah diambil admin lain, coba approve ulang");

      const [updatedOrder] = await tx
        .update(orders)
        .set({ status: "paid" })
        .where(eq(orders.id, locked.id))
        .returning();

      if (!updatedOrder) throw new HttpError(500, "Failed to update order status");

      await tx.insert(logs).values({
        action: "sold",
        keyId: claimed.id,
        details: `Order approved by admin, assigned to user ${locked.user_id}, order ${locked.id}`,
      });

      return { order: updatedOrder, key: claimed };
    });
  }

  async approveOrderAndAssignKeyByCode(orderId: string, keyCode: string): Promise<{ order: Order; key: Key }> {
    const code = keyCode.trim();
    if (!code) throw new HttpError(400, "Key code wajib diisi");

    return db.transaction(async (tx) => {
      const orderLock = await tx.execute<{ id: string; user_id: string; package_id: number; price: string; status: string }>(
        sql`select id, user_id, package_id, price, status from orders where id = ${orderId} for update`,
      );
      const locked = orderLock.rows[0];
      if (!locked) throw new HttpError(404, "Order not found");
      if (locked.status !== "waiting_verification") {
        throw new HttpError(400, `Order status must be waiting_verification (current: ${locked.status})`);
      }

      const [pkg] = await tx.select().from(packages).where(eq(packages.id, locked.package_id));
      if (!pkg) throw new HttpError(404, "Package not found");
      const durationMonths = Math.max(1, Math.ceil((pkg.durationDays || 30) / 30));

      const keyLock = await tx.execute<{
        id: number;
        status: string;
        package_id: number | null;
        duration_months: number;
        price: string;
      }>(
        sql`select id, status, package_id, duration_months, price from keys where key_code = ${code} for update`,
      );
      const k = keyLock.rows[0];
      if (!k) throw new HttpError(404, "Key not found");
      if (k.status !== "available") throw new HttpError(409, "Key tidak tersedia");

      const keyPackageId = k.package_id;
      if (keyPackageId != null) {
        if (keyPackageId !== locked.package_id) throw new HttpError(400, "Key ini bukan untuk package order tersebut");
      } else {
        if (k.duration_months !== durationMonths) throw new HttpError(400, "Durasi key tidak sesuai dengan package order");
        if (String(k.price) !== String(locked.price)) throw new HttpError(400, "Harga key tidak sesuai dengan order");
      }

      const [claimed] = await tx
        .update(keys)
        .set({
          status: "sold",
          userId: locked.user_id,
          orderId: locked.id,
          packageId: locked.package_id,
        })
        .where(and(eq(keys.id, k.id), eq(keys.status, "available")))
        .returning();
      if (!claimed) throw new HttpError(409, "Key sudah dipakai proses lain, coba ulang");

      const [updatedOrder] = await tx
        .update(orders)
        .set({ status: "paid" })
        .where(eq(orders.id, locked.id))
        .returning();
      if (!updatedOrder) throw new HttpError(500, "Failed to update order status");

      await tx.insert(logs).values({
        action: "sold",
        keyId: claimed.id,
        details: `Order approved by admin (manual key), assigned to user ${locked.user_id}, order ${locked.id}`,
      });

      return { order: updatedOrder, key: claimed };
    });
  }

  async autoApproveOrderAndAssignKey(orderId: string): Promise<{ order: Order; key: Key }> {
    return db.transaction(async (tx) => {
      const orderLock = await tx.execute<{ id: string; user_id: string; package_id: number; price: string; status: string }>(
        sql`select id, user_id, package_id, price, status from orders where id = ${orderId} for update`,
      );

      const locked = orderLock.rows[0];

      if (!locked) throw new HttpError(404, "Order not found");
      if (locked.status !== "pending" && locked.status !== "waiting_verification") {
        throw new HttpError(400, `Order status must be pending or waiting_verification (current: ${locked.status})`);
      }

      const [pkg] = await tx.select().from(packages).where(eq(packages.id, locked.package_id));
      if (!pkg) throw new HttpError(404, "Package not found");

      const durationMonths = Math.max(1, Math.ceil((pkg.durationDays || 30) / 30));

      const exactKey = await tx.execute<{ id: number }>(
        sql`select id from keys where status = 'available' and package_id = ${locked.package_id} order by id asc limit 1 for update skip locked`,
      );
      const exactId = exactKey.rows[0]?.id;

      const fallbackKey = exactId
        ? null
        : await tx.execute<{ id: number }>(
            sql`select id from keys where status = 'available' and package_id is null and duration_months = ${durationMonths} and price = ${locked.price} order by id asc limit 1 for update skip locked`,
          );
      const fallbackId = fallbackKey ? fallbackKey.rows[0]?.id : undefined;

      const selectedId = exactId ?? fallbackId;
      if (!selectedId) throw new HttpError(409, "Stock kosong untuk paket ini");

      const [claimed] = await tx
        .update(keys)
        .set({
          status: "sold",
          userId: locked.user_id,
          orderId: locked.id,
          packageId: locked.package_id,
        })
        .where(and(eq(keys.id, selectedId), eq(keys.status, "available")))
        .returning();

      if (!claimed) throw new HttpError(409, "Key sudah diambil proses lain, coba ulang");

      const [updatedOrder] = await tx
        .update(orders)
        .set({ status: "paid" })
        .where(eq(orders.id, locked.id))
        .returning();

      if (!updatedOrder) throw new HttpError(500, "Failed to update order status");

      await tx.insert(logs).values({
        action: "sold",
        keyId: claimed.id,
        details: `Order auto-approved, assigned to user ${locked.user_id}, order ${locked.id}`,
      });

      return { order: updatedOrder, key: claimed };
    });
  }

  async rejectOrder(orderId: string): Promise<Order> {
    const order = await this.getOrder(orderId);
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "waiting_verification") {
      throw new HttpError(400, `Order status must be waiting_verification (current: ${order.status})`);
    }
    const updated = await this.updateOrder(order.id, { status: "rejected" });
    if (!updated) throw new HttpError(500, "Failed to reject order");
    return updated;
  }

  async deleteKey(id: number): Promise<boolean> {
    await db.delete(logs).where(eq(logs.keyId, id));

    const result = await db
      .delete(keys)
      .where(eq(keys.id, id))
      .returning();

    return result.length > 0;
  }

  async createLog(log: InsertLog): Promise<Log> {
    const [created] = await db.insert(logs).values(log).returning();
    return created;
  }

  async getRecentLogs(
    limit: number
  ): Promise<(Log & { key?: Key })[]> {
    const result = await db
      .select()
      .from(logs)
      .leftJoin(keys, eq(logs.keyId, keys.id))
      .orderBy(desc(logs.timestamp))
      .limit(limit);

    return result.map((row) => ({
      ...row.logs,
      key: row.keys || undefined,
    }));
  }

  async getDashboardStats() {
    await this.updateExpiredKeys();

    const allKeys = await db.select().from(keys);

    const totalKeys = allKeys.length;
    const activeKeys = allKeys.filter((k) => k.status === "active").length;
    const expiredKeys = allKeys.filter((k) => k.status === "expired").length;
    const unusedKeys = allKeys.filter((k) => k.status === "unused" || k.status === "available" || k.status === "sold").length;

    const totalRevenue = allKeys
      .reduce((sum, k) => sum + parseFloat(k.price), 0)
      .toFixed(2);

    const recentActivations = await this.getRecentLogs(10);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activationsLogs = await db
      .select()
      .from(logs)
      .where(
        and(
          eq(logs.action, "activated"),
          gte(logs.timestamp, thirtyDaysAgo)
        )
      );

    const chartDataMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      chartDataMap.set(dateStr, 0);
    }

    activationsLogs.forEach((log) => {
      const dateStr = new Date(log.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (chartDataMap.has(dateStr)) {
        chartDataMap.set(
          dateStr,
          (chartDataMap.get(dateStr) || 0) + 1
        );
      }
    });

    const chartData = Array.from(chartDataMap.entries())
      .map(([date, activations]) => ({ date, activations }))
      .reverse();

    return {
      totalKeys,
      activeKeys,
      expiredKeys,
      unusedKeys,
      totalRevenue,
      recentActivations,
      chartData,
    };
  }

  async getRevenueStats() {
    const allKeys = await db.select().from(keys);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const totalRevenue = allKeys
      .reduce((sum, k) => sum + parseFloat(k.price), 0)
      .toFixed(2);

    const monthlyRevenue = allKeys
      .filter((k) => new Date(k.createdAt) >= startOfMonth)
      .reduce((sum, k) => sum + parseFloat(k.price), 0)
      .toFixed(2);

    const weeklyRevenue = allKeys
      .filter((k) => new Date(k.createdAt) >= startOfWeek)
      .reduce((sum, k) => sum + parseFloat(k.price), 0)
      .toFixed(2);

    const todayRevenue = allKeys
      .filter((k) => new Date(k.createdAt) >= startOfDay)
      .reduce((sum, k) => sum + parseFloat(k.price), 0)
      .toFixed(2);

    const durationGroups = new Map<
      number,
      { revenue: number; count: number }
    >();

    allKeys.forEach((key) => {
      const existing =
        durationGroups.get(key.durationMonths) || {
          revenue: 0,
          count: 0,
        };
      durationGroups.set(key.durationMonths, {
        revenue: existing.revenue + parseFloat(key.price),
        count: existing.count + 1,
      });
    });

    const revenueByDuration = Array.from(durationGroups.entries())
      .map(([months, data]) => ({
        duration: `${months}M`,
        revenue: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => parseInt(a.duration) - parseInt(b.duration));

    const transactions = allKeys
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, 20)
      .map((k) => ({
        id: k.id,
        keyCode: k.keyCode,
        price: k.price,
        durationMonths: k.durationMonths,
        createdAt: k.createdAt.toISOString(),
      }));

    return {
      totalRevenue,
      monthlyRevenue,
      weeklyRevenue,
      todayRevenue,
      revenueByDuration,
      transactions,
    };
  }

  async updateExpiredKeys(): Promise<void> {
    const now = new Date();
    await db
      .update(keys)
      .set({ status: "expired" })
      .where(
        and(
          eq(keys.status, "active"),
          sql`${keys.expiresAt} < ${now}`
        )
      );
  }

  // ✅ METHOD YANG DIMINTA
  async resetKeyHwid(keyCode: string): Promise<Key | undefined> {
    const [updated] = await db
      .update(keys)
      .set({
        hwid: null,
      })
      .where(eq(keys.keyCode, keyCode))
      .returning();

    return updated || undefined;
  }

  async getAllShowcase(): Promise<Showcase[]> {
    return db
      .select()
      .from(showcase)
      .orderBy(asc(showcase.sortOrder), asc(showcase.id));
  }

  async getShowcasePaginated(limit: number, offset: number): Promise<Showcase[]> {
    return db
      .select()
      .from(showcase)
      .orderBy(asc(showcase.sortOrder), asc(showcase.id))
      .limit(limit)
      .offset(offset);
  }

  async getShowcaseTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(showcase);
    return result[0]?.count ?? 0;
  }

  async getShowcase(id: number): Promise<Showcase | undefined> {
    const [row] = await db.select().from(showcase).where(eq(showcase.id, id));
    return row || undefined;
  }

  async createShowcase(data: InsertShowcase): Promise<Showcase> {
    const [created] = await db.insert(showcase).values(data).returning();
    return created;
  }

  async updateShowcase(id: number, data: Partial<Showcase>): Promise<Showcase | undefined> {
    const [updated] = await db
      .update(showcase)
      .set(data)
      .where(eq(showcase.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShowcase(id: number): Promise<boolean> {
    const result = await db.delete(showcase).where(eq(showcase.id, id)).returning();
    return result.length > 0;
  }

  async incrementShowcaseView(id: number): Promise<Showcase | undefined> {
    const [updated] = await db
      .update(showcase)
      .set({ viewCount: sql`${showcase.viewCount} + 1` })
      .where(eq(showcase.id, id))
      .returning();
    return updated || undefined;
  }

  async incrementShowcaseLike(id: number): Promise<Showcase | undefined> {
    const [updated] = await db
      .update(showcase)
      .set({ likeCount: sql`${showcase.likeCount} + 1` })
      .where(eq(showcase.id, id))
      .returning();
    return updated || undefined;
  }

  async incrementShowcaseTip(id: number): Promise<Showcase | undefined> {
    const [updated] = await db
      .update(showcase)
      .set({ tipCount: sql`${showcase.tipCount} + 1` })
      .where(eq(showcase.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllPackages(): Promise<Package[]> {
    return db
      .select()
      .from(packages)
      .orderBy(asc(packages.sortOrder), asc(packages.id));
  }

  async getPackagesPaginated(limit: number, offset: number): Promise<Package[]> {
    return db
      .select()
      .from(packages)
      .orderBy(asc(packages.sortOrder), asc(packages.id))
      .limit(limit)
      .offset(offset);
  }

  async getPackagesTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(packages);
    return result[0]?.count ?? 0;
  }

  async getPackage(id: number): Promise<Package | undefined> {
    const [row] = await db.select().from(packages).where(eq(packages.id, id));
    return row || undefined;
  }

  async createPackage(data: InsertPackage): Promise<Package> {
    const [created] = await db.insert(packages).values(data).returning();
    return created;
  }

  async updatePackage(id: number, data: Partial<Package>): Promise<Package | undefined> {
    const [updated] = await db
      .update(packages)
      .set(data)
      .where(eq(packages.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePackage(id: number): Promise<boolean> {
    const result = await db.delete(packages).where(eq(packages.id, id)).returning();
    return result.length > 0;
  }

  async getPackageStocks(): Promise<Array<{ id: number; title: string; durationDays: number; price: string; exactAvailable: number; genericAvailable: number; totalAvailable: number }>> {
    const pkgRows = await this.getAllPackages();

    const exactRows = await db
      .select({
        packageId: keys.packageId,
        count: sql<number>`count(*)::int`,
      })
      .from(keys)
      .where(and(eq(keys.status, "available"), sql`${keys.packageId} is not null`))
      .groupBy(keys.packageId);

    const genericRows = await db
      .select({
        durationMonths: keys.durationMonths,
        price: keys.price,
        count: sql<number>`count(*)::int`,
      })
      .from(keys)
      .where(and(eq(keys.status, "available"), isNull(keys.packageId)))
      .groupBy(keys.durationMonths, keys.price);

    const exactByPackageId = new Map<number, number>();
    for (const r of exactRows) {
      if (r.packageId == null) continue;
      exactByPackageId.set(r.packageId, r.count ?? 0);
    }

    const genericByBucket = new Map<string, number>();
    for (const r of genericRows) {
      const key = `${r.durationMonths}|${String(r.price)}`;
      genericByBucket.set(key, r.count ?? 0);
    }

    return pkgRows.map((p) => {
      const durationMonths = Math.max(1, Math.ceil((p.durationDays || 30) / 30));
      const exactAvailable = exactByPackageId.get(p.id) ?? 0;
      const genericAvailable = genericByBucket.get(`${durationMonths}|${String(p.price)}`) ?? 0;
      return {
        id: p.id,
        title: p.title,
        durationDays: p.durationDays,
        price: String(p.price),
        exactAvailable,
        genericAvailable,
        totalAvailable: exactAvailable + genericAvailable,
      };
    });
  }

  async getAllTeams(): Promise<Team[]> {
    return db
      .select()
      .from(teams)
      .orderBy(asc(teams.sortOrder), asc(teams.id));
  }

  async getTeamsPaginated(limit: number, offset: number): Promise<Team[]> {
    return db
      .select()
      .from(teams)
      .orderBy(asc(teams.sortOrder), asc(teams.id))
      .limit(limit)
      .offset(offset);
  }

  async getTeamsTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(teams);
    return result[0]?.count ?? 0;
  }

  async getTeam(id: number): Promise<Team | undefined> {
    const [row] = await db.select().from(teams).where(eq(teams.id, id));
    return row || undefined;
  }

  async createTeam(data: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(data).returning();
    return created;
  }

  async updateTeam(id: number, data: Partial<Team>): Promise<Team | undefined> {
    const [updated] = await db
      .update(teams)
      .set(data)
      .where(eq(teams.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTeam(id: number): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    return result.length > 0;
  }

  async getAllTestimonials(): Promise<Testimonial[]> {
    return db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.id));
  }

  async getTestimonialsPaginated(limit: number, offset: number): Promise<Testimonial[]> {
    return db.select().from(testimonials).orderBy(asc(testimonials.sortOrder), asc(testimonials.id)).limit(limit).offset(offset);
  }

  async getTestimonialsTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(testimonials);
    return result[0]?.count ?? 0;
  }

  async getTestimonial(id: number): Promise<Testimonial | undefined> {
    const [row] = await db.select().from(testimonials).where(eq(testimonials.id, id));
    return row || undefined;
  }

  async createTestimonial(data: InsertTestimonial): Promise<Testimonial> {
    const [created] = await db.insert(testimonials).values(data).returning();
    return created;
  }

  async updateTestimonial(id: number, data: Partial<Testimonial>): Promise<Testimonial | undefined> {
    const [updated] = await db.update(testimonials).set(data).where(eq(testimonials.id, id)).returning();
    return updated || undefined;
  }

  async deleteTestimonial(id: number): Promise<boolean> {
    const result = await db.delete(testimonials).where(eq(testimonials.id, id)).returning();
    return result.length > 0;
  }

  async getAllGameSupport(): Promise<GameSupport[]> {
    return db.select().from(gameSupport).orderBy(asc(gameSupport.sortOrder), asc(gameSupport.id));
  }

  async getGameSupportPaginated(limit: number, offset: number): Promise<GameSupport[]> {
    return db.select().from(gameSupport).orderBy(asc(gameSupport.sortOrder), asc(gameSupport.id)).limit(limit).offset(offset);
  }

  async getGameSupportTotal(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(gameSupport);
    return result[0]?.count ?? 0;
  }

  async getGameSupport(id: number): Promise<GameSupport | undefined> {
    const [row] = await db.select().from(gameSupport).where(eq(gameSupport.id, id));
    return row || undefined;
  }

  async createGameSupport(data: InsertGameSupport): Promise<GameSupport> {
    const [created] = await db.insert(gameSupport).values(data).returning();
    return created;
  }

  async updateGameSupport(id: number, data: Partial<GameSupport>): Promise<GameSupport | undefined> {
    const [updated] = await db.update(gameSupport).set(data).where(eq(gameSupport.id, id)).returning();
    return updated || undefined;
  }

  async deleteGameSupport(id: number): Promise<boolean> {
    const result = await db.delete(gameSupport).where(eq(gameSupport.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
