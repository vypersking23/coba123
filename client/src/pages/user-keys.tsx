"use client"

import { useEffect, useMemo, useState } from "react";
import { Cpu, Loader2, RotateCcw, Clock } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function formatDateId(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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

export function UserKeys() {
  const { toast } = useToast();
  const { token } = useUserAuth();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetKey, setResetTargetKey] = useState<UserKeyRow | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data, isLoading } = useQuery<{ keys: UserKeyRow[] }>({
    queryKey: ["/api/user/keys"],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch("/api/user/keys", { headers: authHeaders });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Gagal ambil keys");
      return json;
    },
  });

  const keys = data?.keys || [];
  const stats = useMemo(() => {
    const total = keys.length;
    const active = keys.filter((k) => k.status === "active").length;
    const expired = keys.filter((k) => k.status === "expired").length;
    const resetReady = keys.filter((k) => {
      if (k.status !== "active") return false;
      if (!k.hwid) return false;
      if (!k.hwidResetAt) return true;
      const next = new Date(k.hwidResetAt).getTime() + 20 * 60 * 1000;
      return nowMs >= next;
    }).length;
    return { total, active, expired, resetReady };
  }, [keys, nowMs]);

  const resetHwidMutation = useMutation({
    mutationFn: async (key: UserKeyRow) => {
      const res = await fetch(`/api/user/keys/${key.id}/reset-hwid`, {
        method: "POST",
        headers: authHeaders,
      });
      const json = await res.json();
      if (res.status === 429) throw new Error(json.message || "Bisa reset lagi dalam 20 menit");
      if (!res.ok) throw new Error(json.message || "Gagal reset HWID");
      return json as { success: boolean; message: string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/keys"] });
      toast({ title: "Berhasil", description: result.message || "HWID berhasil di-reset" });
      setResetDialogOpen(false);
      setResetTargetKey(null);
    },
    onError: (e: unknown) => {
      toast({ title: "Gagal reset", description: e instanceof Error ? e.message : "Terjadi error", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-wide">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan key kamu dan reset HWID.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Key</div>
            <div className="mt-2 text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Key Aktif</div>
            <div className="mt-2 text-2xl font-bold">{stats.active}</div>
            {stats.expired ? <div className="mt-1 text-xs text-muted-foreground">Expired: {stats.expired}</div> : null}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">Reset HWID Ready</div>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{stats.resetReady}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>My Keys</CardTitle>
          <CardDescription>Reset HWID hanya tersedia untuk key yang sudah aktif dan sudah terikat device.</CardDescription>
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

          {isLoading ? (
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
                {keys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Belum ada key.
                    </TableCell>
                  </TableRow>
                ) : (
                  keys.map((k) => {
                    const isActive = k.status === "active";
                    const hasHwid = !!k.hwid;
                    const nextAllowedAt = k.hwidResetAt ? new Date(k.hwidResetAt).getTime() + 20 * 60 * 1000 : null;
                    const msLeft = nextAllowedAt ? nextAllowedAt - nowMs : 0;
                    const canReset = isActive && hasHwid && (!nextAllowedAt || msLeft <= 0);
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono">{k.keyCode}</TableCell>
                        <TableCell>{k.packageTitle || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={k.status === "active" ? "default" : k.status === "expired" ? "destructive" : "secondary"}>
                            {k.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-[180px] truncate font-mono text-xs">{k.hwid || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isActive ? (
                            <span className="text-muted-foreground">—</span>
                          ) : !hasHwid ? (
                            <span className="text-muted-foreground">Belum terikat</span>
                          ) : !canReset ? (
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {formatRemaining(msLeft)}
                            </span>
                          ) : (
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
                          )}
                        </TableCell>
                        <TableCell>{formatDateId(k.expiresAt)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
