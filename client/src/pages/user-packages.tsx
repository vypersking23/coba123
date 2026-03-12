"use client"

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useUserAuth } from "@/lib/user-auth";
import type { Package } from "@shared/schema";

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

export function UserPackages() {
  const { toast } = useToast();
  const { token } = useUserAuth();
  const [activeOrder, setActiveOrder] = useState<CreatedOrder | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [paymentLinkRequestedFor, setPaymentLinkRequestedFor] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const res = await fetch("/api/packages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: ordersData } = useQuery<{ orders: UserOrderRow[] }>({
    queryKey: ["/api/user/orders"],
    enabled: !!token,
    refetchInterval: paymentDialogOpen ? 5000 : false,
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
        toast({ title: "Order dibuat, tapi QRIS gagal", description: data.payment.error, variant: "destructive" });
      } else {
        toast({ title: "Order dibuat", description: "Silakan bayar via QRIS." });
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
      toast({ title: "QRIS siap", description: "Scan QR dan bayar sesuai nominal." });
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
      if (!res.ok) throw new Error(data.message || "Gagal cek status pembayaran");
      return data as { id: string; status: string; gateway?: { ok: boolean; message?: string; remoteStatus?: string } };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
      setActiveOrder((prev) => (prev && prev.orderId === data.id ? { ...prev, status: data.status } : prev));
      if (!variables?.silent) {
        if (data.status === "paid") toast({ title: "Pembayaran berhasil", description: "Key otomatis masuk di Dashboard." });
        else toast({ title: "Status", description: data.gateway?.message || data.status });
      }
    },
    onError: (e: unknown) => {
      if (String(e).includes("not authorized")) return;
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

  useEffect(() => {
    const orderId = activeOrder?.orderId;
    if (!orderId) return;
    if (activeOrder.status !== "pending") return;
    const hasPayment = !!activeOrder.payment?.qrString || !!activeOrder.payment?.url;
    if (hasPayment) return;
    if (paymentLinkRequestedFor === orderId) return;
    setPaymentLinkRequestedFor(orderId);
    paymentLinkMutation.mutate(orderId);
  }, [activeOrder?.orderId, activeOrder?.status, activeOrder?.payment?.qrString, activeOrder?.payment?.url, paymentLinkRequestedFor, paymentLinkMutation]);

  useEffect(() => {
    if (!paymentDialogOpen) return;
    if (!currentExpiresAt) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(new Date(currentExpiresAt).getTime() - Date.now());
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
      setActiveOrder(null);
      setPaymentLinkRequestedFor(null);
      queryClient.invalidateQueries({ queryKey: ["/api/user/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/orders"] });
    }, 900);
    return () => clearTimeout(t);
  }, [currentStatus, paymentDialogOpen]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-wide">Packages</h1>
        <p className="text-muted-foreground">Pilih paket, bayar via QRIS, key otomatis masuk.</p>
      </div>

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
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center data-[state=open]:animate-in">
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
                      <img src={qrImageUrl} alt="QRIS" className="mx-auto h-72 w-72 rounded-xl bg-background object-contain shadow-sm" />
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
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Tutup</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Packages
          </CardTitle>
          <CardDescription>Pilih paket yang kamu butuhkan. Pembayaran via QRIS.</CardDescription>
        </CardHeader>
        <CardContent>
          {currentOrderId && currentStatus ? (
            <div className="mb-6 rounded-xl border bg-background/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Order aktif</div>
                  <div className="mt-1 font-mono text-sm">{currentOrderId}</div>
                </div>
                <Badge variant={currentStatus === "paid" ? "default" : currentStatus === "pending" ? "secondary" : "outline"}>{currentStatus}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => setPaymentDialogOpen(true)} disabled={!currentOrderId}>Bayar Sekarang</Button>
                <Button variant="outline" onClick={() => currentOrderId && paymentLinkMutation.mutate(currentOrderId)} disabled={!currentOrderId || paymentLinkMutation.isPending}>
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
            </div>
          ) : null}

          {packages.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada paket.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="group relative overflow-hidden rounded-xl border bg-background/60 p-4 shadow-sm transition hover:shadow-md">
                  {(() => {
                    const price = Number(pkg.price ?? 0) || 0;
                    const original = Number(pkg.originalPrice ?? 0) || 0;
                    const hasDiscount = original > 0 && original > price;
                    return (
                      <>
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
                          <div>
                            {hasDiscount ? (
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm text-muted-foreground line-through">IDR {formatIdr(original)}</span>
                                <span className="text-2xl font-bold">IDR {formatIdr(price)}</span>
                              </div>
                            ) : (
                              <div className="text-2xl font-bold">IDR {formatIdr(price)}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">QRIS</div>
                        </div>
                        <Button
                          className="mt-3 w-full"
                          onClick={() => buyMutation.mutate(pkg.id)}
                          disabled={
                            !token ||
                            buyMutation.isPending ||
                            (!!currentOrderId && currentStatus === "pending")
                          }
                        >
                          {buyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Beli Paket
                        </Button>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
