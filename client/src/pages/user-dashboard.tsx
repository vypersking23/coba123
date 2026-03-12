import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Clock, Cpu, Loader2, LogOut, RotateCcw, ShoppingCart } from "lucide-react";
import { HeaderLogo } from "@/components/header-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useUserAuth } from "@/lib/user-auth";
import type { Package } from "@shared/schema";

type UserKeyRow = {
  id: number;
  keyCode: string;
  packageTitle: string | null;
  status: string;
  expiresAt: string | null;
  hwid?: string | null;
  hwidResetAt?: string | null;
  createdAt: string;
};

type UserOrderRow = {
  id: string;
  packageTitle: string | null;
  price: string;
  status: string;
  createdAt: string;
  payment: {
    provider: string;
    orderId: string | null;
    linkCode: string | null;
    url: string | null;
    qrString?: string | null;
    originalAmount?: number | null;
    totalAmount?: number | null;
    uniqueNominal?: number | null;
    expiresAt: string | null;
  } | null;
};

type CreatedOrder = {
  orderId: string;
  status: string;
  package: {
    id: number;
    title: string;
    durationDays: number;
    price: string;
    buyLink: string;
  };
  payment: {
    provider: string;
    orderId: string | null;
    linkCode: string | null;
    url: string | null;
    qrString?: string | null;
    originalAmount?: number | null;
    totalAmount?: number | null;
    uniqueNominal?: number | null;
    expiresAt: string | null;
    error?: string;
  } | null;
};

function formatDateId(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTimeId(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

function formatRemaining(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function UserDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, token, user, logout } = useUserAuth();
  const [activeOrder, setActiveOrder] = useState<CreatedOrder | null>(null);
  const [paymentLinkRequestedFor, setPaymentLinkRequestedFor] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetKey, setResetTargetKey] = useState<UserKeyRow | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: keysData, isLoading: keysLoading } = useQuery<{ keys: UserKeyRow[] }>({
    queryKey: ["/api/user/keys"],
    enabled: !!token,
    refetchInterval: activeOrder?.status === "waiting_verification" ? 5000 : activeOrder?.status === "pending" ? 5000 : false,
    queryFn: async () => {
      const res = await fetch("/api/user/keys", { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal ambil keys");
      return data;
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: UserOrderRow[] }>({
    queryKey: ["/api/user/orders"],
    enabled: !!token,
    refetchInterval: paymentDialogOpen ? 5000 : activeOrder?.status === "waiting_verification" ? 5000 : activeOrder?.status === "pending" ? 5000 : false,
    queryFn: async () => {
      const res = await fetch("/api/user/orders", { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal ambil orders");
      return data;
    },
  });

  const latestActionableOrder = useMemo(() => {
    const orders = ordersData?.orders || [];
    return orders.find((o) => o.status === "waiting_verification") || orders.find((o) => o.status === "pending") || null;
  }, [ordersData?.orders]);

  const activeOrderRow = useMemo(() => {
    if (!activeOrder?.orderId) return null;
    const orders = ordersData?.orders || [];
    return orders.find((o) => o.id === activeOrder.orderId) || null;
  }, [activeOrder?.orderId, ordersData?.orders]);

  const currentOrderId = activeOrder?.orderId || latestActionableOrder?.id || null;
  const currentStatus = activeOrderRow?.status || activeOrder?.status || latestActionableOrder?.status || null;
  const currentPayment = activeOrderRow?.payment || activeOrder?.payment || latestActionableOrder?.payment || null;
  const currentQrString = currentPayment?.qrString || "";
  const currentTotalAmount = currentPayment?.totalAmount ?? null;
  const currentExpiresAt = currentPayment?.expiresAt || null;
  const qrColor = "ea580c";
  const qrStyle = 3;
  const qrImageUrl = currentQrString
    ? `https://larabert-qrgen.hf.space/v1/create-qr-code?size=560x560&style=${qrStyle}&color=${qrColor}&data=${encodeURIComponent(currentQrString)}`
    : "";

  const myKeys = keysData?.keys || [];
  const keysActive = myKeys.filter((k) => k.status === "active").length;
  const keysExpired = myKeys.filter((k) => k.status === "expired").length;
  const keysResetReady = myKeys.filter((k) => {
    if (k.status !== "active") return false;
    if (!k.hwid) return false;
    if (!k.hwidResetAt) return true;
    const next = new Date(k.hwidResetAt).getTime() + 20 * 60 * 1000;
    return nowMs >= next;
  }).length;

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const res = await fetch("/api/packages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const buyMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const res = await fetch("/api/user/orders", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat order");
      return data as CreatedOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      setActiveOrder(data);
      setPaymentDialogOpen(true);
      if (data.payment && "error" in data.payment && data.payment.error) {
        toast({ title: "Order dibuat, tapi link pembayaran gagal", description: data.payment.error, variant: "destructive" });
      } else {
        toast({ title: "Order dibuat", description: "Popup pembayaran dibuka." });
      }
    },
    onError: (e: unknown) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (params: { orderId: string; silent?: boolean }) => {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(params.orderId)}/confirm`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal konfirmasi pembayaran");
      return data as {
        id: string;
        status: string;
        key?: { id: number; keyCode: string; status: string };
        gateway?: { ok: boolean; message?: string; remoteStatus?: string };
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      if (data.status === "paid") {
        queryClient.invalidateQueries({ queryKey: ["/api/user/keys"] });
      }
      setActiveOrder((prev) => (prev && prev.orderId === data.id ? { ...prev, status: data.status } : prev));
      if (!variables?.silent) {
        if (data.status === "paid") {
          toast({ title: "Pembayaran berhasil", description: "Key sudah otomatis masuk ke akun kamu." });
        } else if (data.status === "waiting_verification") {
          toast({ title: "Pembayaran terdeteksi", description: "Menunggu verifikasi admin." });
        } else if (data.status === "expired") {
          toast({ title: "Transaksi expired", description: "Klik 'Buat Ulang QR' untuk buat transaksi baru.", variant: "destructive" });
        } else if (data.status === "rejected") {
          toast({ title: "Transaksi dibatalkan", description: "Klik 'Buat Ulang QR' untuk buat transaksi baru.", variant: "destructive" });
        } else {
          toast({ title: "Masih pending", description: data.gateway?.message || "Belum terdeteksi pembayaran." });
        }
      }
    },
    onError: (e: unknown) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderId)}/payment-link`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat QRIS");
      return data as { orderId: string; status: string; payment: CreatedOrder["payment"] };
    },
    onSuccess: (data) => {
      setActiveOrder((prev) => (prev && prev.orderId === data.orderId ? { ...prev, payment: data.payment } : prev));
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      setPaymentDialogOpen(true);
      toast({ title: "QRIS siap", description: "Silakan scan QR dan bayar sesuai nominal." });
    },
    onError: (e: unknown) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/user/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membatalkan order");
      return data as { id: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      setActiveOrder(null);
      setPaymentLinkRequestedFor(null);
      setPaymentDialogOpen(false);
      toast({ title: "Order dibatalkan" });
    },
    onError: (e: unknown) => {
      toast({ title: "Gagal batalkan order", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  const resetHwidMutation = useMutation({
    mutationFn: async (key: UserKeyRow) => {
      const res = await fetch(`/api/user/keys/${key.id}/reset-hwid`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      if (res.status === 429) {
        const message = data.message || "Bisa reset lagi dalam 20 menit";
        throw new Error(message);
      }
      if (!res.ok) throw new Error(data.message || "Gagal reset HWID");
      return data as { success: boolean; message: string; resetAvailableAt?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/keys"] });
      toast({ title: "Berhasil", description: data.message || "HWID berhasil di-reset" });
      setResetDialogOpen(false);
      setResetTargetKey(null);
    },
    onError: (e: unknown) => {
      toast({ title: "Gagal reset", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  useEffect(() => {
    const orderId = activeOrder?.orderId;
    if (!orderId) return;
    const status = activeOrder.status;
    if (status !== "pending") return;
    const hasPayment = !!activeOrder.payment?.qrString || !!activeOrder.payment?.url;
    if (hasPayment) return;
    if (paymentLinkRequestedFor === orderId) return;
    setPaymentLinkRequestedFor(orderId);
    paymentLinkMutation.mutate(orderId);
  }, [activeOrder?.orderId, activeOrder?.status, activeOrder?.payment?.qrString, activeOrder?.payment?.url, paymentLinkRequestedFor, paymentLinkMutation]);

  useEffect(() => {
    if (!activeOrder) return;
    const orders = ordersData?.orders || [];
    const latest = orders.find((o) => o.id === activeOrder.orderId);
    if (!latest) return;
    if (latest.status === "paid") {
      if (!paymentDialogOpen) {
        setActiveOrder(null);
        setPaymentLinkRequestedFor(null);
      }
      return;
    }
    if (latest.status === "rejected") {
      setActiveOrder(null);
      setPaymentLinkRequestedFor(null);
    }
  }, [ordersData?.orders, activeOrder, paymentDialogOpen]);

  useEffect(() => {
    if (!paymentDialogOpen) return;
    if (!currentExpiresAt) {
      setRemainingMs(null);
      return;
    }
    const tick = () => {
      const ms = new Date(currentExpiresAt).getTime() - Date.now();
      setRemainingMs(ms);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [paymentDialogOpen, currentExpiresAt]);

  useEffect(() => {
    if (!paymentDialogOpen) {
      setPaymentSuccess(false);
      return;
    }
    if (currentStatus !== "paid" && currentStatus !== "waiting_verification") return;
    setPaymentSuccess(true);
    const t = setTimeout(() => {
      setPaymentDialogOpen(false);
      setPaymentSuccess(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
    }, 900);
    return () => clearTimeout(t);
  }, [currentStatus, paymentDialogOpen]);

  const doLogout = () => {
    logout();
    toast({ title: "Logout berhasil" });
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background circuit-overlay">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-serif text-lg font-bold">
            <HeaderLogo size="sm" />
            KingVypers
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={doLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-10 md:py-14">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-serif text-3xl font-bold tracking-wide">Dashboard</h1>
            <p className="text-muted-foreground">
              {user ? `Login sebagai ${user.username} (${user.email})` : "Memuat profile..."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="glass">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Key</div>
                <div className="mt-2 text-2xl font-bold">{myKeys.length}</div>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Key Aktif</div>
                <div className="mt-2 text-2xl font-bold">{keysActive}</div>
                {keysExpired ? <div className="mt-1 text-xs text-muted-foreground">Expired: {keysExpired}</div> : null}
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">Reset HWID Ready</div>
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 text-2xl font-bold">{keysResetReady}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Packages
              </CardTitle>
              <CardDescription>Order dibuat dulu, bayar via QRIS, lalu key otomatis masuk setelah pembayaran terdeteksi.</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog
                open={paymentDialogOpen}
                onOpenChange={(open) => {
                  setPaymentDialogOpen(open);
                  if (!open) setPaymentSuccess(false);
                }}
              >
                <DialogContent className="max-w-md overflow-hidden p-0">
                  <div className="border-b bg-gradient-to-r from-primary/15 via-background to-orange-500/10 p-5">
                    <DialogHeader>
                      <DialogTitle>Pembayaran QRIS</DialogTitle>
                      <DialogDescription>Scan QR, lalu bayar sesuai nominal.</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Total bayar</div>
                        <div className="mt-1 text-2xl font-bold">IDR {formatIdr(currentTotalAmount ?? 0)}</div>
                      </div>
                      {currentStatus ? (
                        <Badge variant={currentStatus === "paid" ? "default" : currentStatus === "pending" ? "secondary" : "outline"}>
                          {currentStatus === "pending"
                            ? "Menunggu"
                            : currentStatus === "waiting_verification"
                              ? "Terdeteksi"
                              : currentStatus}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="relative p-5">
                    {paymentSuccess ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <div className="relative flex h-20 w-20 items-center justify-center">
                          <div className="absolute h-20 w-20 rounded-full bg-emerald-500/20 animate-ping" />
                          <div className="absolute h-20 w-20 rounded-full bg-emerald-500/10" />
                          <CheckCircle2 className="relative h-12 w-12 text-emerald-500" />
                        </div>
                        <div className="text-xl font-semibold">
                          {currentStatus === "waiting_verification" ? "Pembayaran terdeteksi" : "Pembayaran berhasil"}
                        </div>
                        <div className="text-sm text-muted-foreground">Menutup otomatis...</div>
                      </div>
                    ) : (
                      <>
                        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-background to-muted/40 p-4">
                          {qrImageUrl ? (
                            <a href={qrImageUrl} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={qrImageUrl}
                                alt="QRIS"
                                className="mx-auto h-72 w-72 rounded-xl bg-background object-contain shadow-sm"
                              />
                            </a>
                          ) : (
                            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                              {paymentLinkMutation.isPending ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Menyiapkan QRIS...
                                </div>
                              ) : (
                                "QRIS belum tersedia"
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            Sisa waktu: <span className="font-mono">{remainingMs === null ? "—" : formatRemaining(remainingMs)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {currentExpiresAt ? formatDateTimeId(currentExpiresAt) : "—"}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => currentOrderId && confirmMutation.mutate({ orderId: currentOrderId })}
                            disabled={!currentOrderId || currentStatus !== "pending" || confirmMutation.isPending}
                          >
                            {confirmMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Cek Status
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => currentOrderId && paymentLinkMutation.mutate(currentOrderId)}
                            disabled={!currentOrderId || paymentLinkMutation.isPending}
                          >
                            {paymentLinkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Refresh QR
                          </Button>
                          <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                            Tutup
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              {(activeOrder || latestActionableOrder) ? (
                <div className="mb-5 rounded-lg border bg-background/60 p-4">
                  <div className="text-sm text-muted-foreground">Order aktif</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="font-mono text-sm">{currentOrderId}</div>
                    {currentStatus ? (
                      <Badge variant={currentStatus === "paid" ? "default" : currentStatus === "pending" ? "secondary" : "outline"}>
                        {currentStatus}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => setPaymentDialogOpen(true)}
                      disabled={!currentOrderId}
                    >
                      Bayar Sekarang
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => currentOrderId && paymentLinkMutation.mutate(currentOrderId)}
                      disabled={!currentOrderId || paymentLinkMutation.isPending}
                    >
                      {paymentLinkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Buat Ulang QR
                    </Button>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => currentOrderId && cancelMutation.mutate(currentOrderId)}
                        disabled={!currentOrderId || currentStatus !== "pending" || cancelMutation.isPending}
                      >
                        {cancelMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Batalkan Pembelian
                      </Button>
                  </div>
                  {!activeOrder && latestActionableOrder ? (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Pembayaran akan dicek otomatis. Kamu juga bisa buka popup pembayaran.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {packages.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada paket.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="group relative overflow-hidden rounded-xl border bg-background/60 p-4 shadow-sm transition hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{pkg.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{pkg.durationDays} hari akses</div>
                        </div>
                        {pkg.isPopular ? <Badge>Popular</Badge> : null}
                      </div>

                      {pkg.imageUrl ? (
                        <div className="mt-3 overflow-hidden rounded-lg border bg-muted/20">
                          <img src={pkg.imageUrl} alt={pkg.title} className="h-28 w-full object-cover" />
                        </div>
                      ) : (
                        <div className="mt-3 h-28 overflow-hidden rounded-lg border bg-gradient-to-r from-primary/10 via-background to-orange-500/10" />
                      )}

                      <div className="mt-3 flex items-end justify-between gap-3">
                        {(() => {
                          const price = Number(pkg.price ?? 0) || 0;
                          const original = Number(pkg.originalPrice ?? 0) || 0;
                          const hasDiscount = original > 0 && original > price;
                          if (!hasDiscount) return <div className="text-2xl font-bold">IDR {formatIdr(price)}</div>;
                          return (
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm text-muted-foreground line-through">IDR {formatIdr(original)}</span>
                              <span className="text-2xl font-bold">IDR {formatIdr(price)}</span>
                            </div>
                          );
                        })()}
                        <div className="text-xs text-muted-foreground">QRIS</div>
                      </div>

                      <Button
                        className="mt-3 w-full"
                        onClick={() => buyMutation.mutate(pkg.id)}
                        disabled={
                          !token ||
                          buyMutation.isPending ||
                          (ordersData?.orders || []).some((o) => o.status === "pending")
                        }
                      >
                        {buyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Beli Paket
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>My Keys</CardTitle>
              <CardDescription>Daftar key yang kamu miliki</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog
                open={resetDialogOpen}
                onOpenChange={(open) => {
                  setResetDialogOpen(open);
                  if (!open) setResetTargetKey(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset HWID</AlertDialogTitle>
                    <AlertDialogDescription>
                      Reset HWID akan melepas device yang terikat. Setelah reset, key bisa dipakai di device baru.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {resetTargetKey ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Key</span>
                        <span className="font-mono">{resetTargetKey.keyCode}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">HWID</span>
                        <span className="max-w-[220px] truncate font-mono text-xs">{resetTargetKey.hwid || "—"}</span>
                      </div>
                    </div>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={resetHwidMutation.isPending}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => resetTargetKey && resetHwidMutation.mutate(resetTargetKey)}
                      disabled={!resetTargetKey || resetHwidMutation.isPending}
                    >
                      {resetHwidMutation.isPending ? "Memproses..." : "Reset HWID"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {keysLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>HWID</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Expiration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(keysData?.keys || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Belum ada key.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (keysData?.keys || []).map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="font-mono">{k.keyCode}</TableCell>
                          <TableCell>{k.packageTitle || "—"}</TableCell>
                          <TableCell>{k.status}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-muted-foreground" />
                              <span className="max-w-[160px] truncate font-mono text-xs">{k.hwid || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const isActive = k.status === "active";
                              const hasHwid = !!k.hwid;
                              const nextAllowedAt = k.hwidResetAt ? new Date(k.hwidResetAt).getTime() + 20 * 60 * 1000 : null;
                              const msLeft = nextAllowedAt ? nextAllowedAt - nowMs : 0;
                              const canReset = isActive && hasHwid && (!nextAllowedAt || msLeft <= 0);

                              if (!isActive) return <span className="text-muted-foreground">—</span>;
                              if (!hasHwid) return <span className="text-muted-foreground">Belum terikat</span>;
                              if (!canReset) {
                                return (
                                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatRemaining(msLeft)}
                                  </span>
                                );
                              }
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => {
                                    setResetTargetKey(k);
                                    setResetDialogOpen(true);
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reset HWID
                                </Button>
                              );
                            })()}
                          </TableCell>
                          <TableCell>{formatDateId(k.expiresAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>Riwayat order kamu</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ordersData?.orders || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Belum ada order.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ordersData?.orders || []).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono">{o.id}</TableCell>
                          <TableCell>{o.packageTitle || "—"}</TableCell>
                          <TableCell>IDR {formatIdr(o.price)}</TableCell>
                          <TableCell>{o.status}</TableCell>
                          <TableCell>{formatDateId(o.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
