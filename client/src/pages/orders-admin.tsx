import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type AdminOrderRow = {
  id: string;
  status: string;
  price: string;
  createdAt: string;
  user: { id: string; username: string; email: string } | null;
  package: { id: number; title: string } | null;
  payment: {
    provider: string;
    orderId: string | null;
    linkCode: string | null;
    url: string | null;
    expiresAt: string | null;
  } | null;
};

function formatDateId(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTimeId(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatIdr(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) || 0 : Number(value);
  return new Intl.NumberFormat("id-ID").format(n);
}

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "waiting_verification":
      return <Badge variant="default" className="bg-chart-3 text-white">Waiting Verification</Badge>;
    case "paid":
      return <Badge variant="default" className="bg-chart-2 text-white">Paid</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "expired":
      return <Badge variant="outline">Expired</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function OrdersAdmin() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const [keyCodeByOrderId, setKeyCodeByOrderId] = useState<Record<string, string>>({});
  const [approvingByOrderId, setApprovingByOrderId] = useState<Record<string, boolean>>({});
  const pageSize = 10;

  const { data, isLoading, error } = useQuery<{ orders: AdminOrderRow[]; total?: number }>({
    queryKey: ["/api/admin/orders", statusFilter, page],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const q = new URLSearchParams();
      q.set("status", statusFilter);
      q.set("limit", String(pageSize));
      q.set("offset", String(offset));
      return apiRequest("GET", `/api/admin/orders?${q.toString()}`);
    },
  });

  const orders = data?.orders || [];
  const total = data?.total ?? orders.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showActions = useMemo(() => statusFilter === "waiting_verification" || statusFilter === "all", [statusFilter]);

  const approveWithKey = async (orderId: string) => {
    const keyCode = String(keyCodeByOrderId[orderId] || "").trim();
    if (!keyCode) {
      toast({ title: "Error", description: "Key code wajib diisi", variant: "destructive" });
      return;
    }
    setApprovingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    try {
      await apiRequest("POST", `/api/admin/orders/${encodeURIComponent(orderId)}/approve`, { keyCode });
      toast({ title: "Berhasil", description: "Order di-approve dan key dikirim." });
      setKeyCodeByOrderId((prev) => ({ ...prev, [orderId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
    } catch (e: unknown) {
      toast({ title: "Gagal approve", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    } finally {
      setApprovingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide">Order Logs</h1>
          <p className="text-muted-foreground">Log transaksi order (read-only).</p>
        </div>
        <div className="w-full sm:w-60">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="waiting_verification">waiting_verification</SelectItem>
              <SelectItem value="paid">paid</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
              <SelectItem value="expired">expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Order</CardTitle>
          <CardDescription>{total} order</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{(error as Error).message}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment</TableHead>
                    {showActions ? <TableHead>Action</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showActions ? 8 : 7} className="text-center text-muted-foreground">
                        Tidak ada order.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o) => {
                      const canManualApprove = o.status === "waiting_verification";
                      const approving = !!approvingByOrderId[o.id];
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-xs">{o.id}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{o.user?.username || "—"}</div>
                            <div className="text-xs text-muted-foreground">{o.user?.email || "—"}</div>
                          </TableCell>
                          <TableCell>{o.package?.title || "—"}</TableCell>
                          <TableCell>IDR {formatIdr(o.price)}</TableCell>
                          <TableCell>{statusBadge(o.status)}</TableCell>
                          <TableCell>{formatDateId(o.createdAt)}</TableCell>
                          <TableCell>
                            {o.payment?.url ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary">{o.payment.provider}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDateTimeId(o.payment.expiresAt)}</span>
                                </div>
                                <Button size="sm" variant="outline" asChild>
                                  <a href={o.payment.url} target="_blank" rel="noopener noreferrer">
                                    Open
                                  </a>
                                </Button>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {o.payment.orderId || "—"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {showActions ? (
                            <TableCell>
                              {canManualApprove ? (
                                <div className="flex max-w-[260px] flex-col gap-2">
                                  <Input
                                    placeholder="Masukkan key code"
                                    value={keyCodeByOrderId[o.id] || ""}
                                    onChange={(e) =>
                                      setKeyCodeByOrderId((prev) => ({ ...prev, [o.id]: e.target.value }))
                                    }
                                    disabled={approving}
                                  />
                                  <Button size="sm" onClick={() => approveWithKey(o.id)} disabled={approving}>
                                    {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Approve
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p: number;
                        if (totalPages <= 5) p = i + 1;
                        else if (page <= 3) p = i + 1;
                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                        else p = page - 2 + i;
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(p);
                              }}
                              isActive={page === p}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.min(totalPages, p + 1));
                          }}
                          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
