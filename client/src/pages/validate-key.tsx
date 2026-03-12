import { useState, useEffect } from "react";
import { Link } from "wouter";
import { HeaderLogo } from "@/components/header-logo";
import {
  Key,
  Loader2,
  Calendar,
  Cpu,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const HWID_RESET_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

type KeyInfo = {
  success: boolean;
  status: string;
  message: string;
  expiresAt?: string | null;
  hwid?: string | null;
  hwidResetAt?: string | null;
} | null;

export default function ValidateKey() {
  const [keyInput, setKeyInput] = useState("");
  const [keyInfo, setKeyInfo] = useState<KeyInfo>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetAvailableAt, setResetAvailableAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const { toast } = useToast();

  const normalizeKey = (value: string) => {
    const v = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const parts = v.replace(/-/g, "").match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join("-");
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyInput(normalizeKey(e.target.value));
    setKeyInfo(null);
  };

  const fetchKeyInfo = async (key: string) => {
    const res = await fetch(`/api/check-key/${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Gagal cek key");
    }
    return data;
  };

  const handleCekKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = keyInput.trim();
    if (!key || key.replace(/-/g, "").length !== 16) {
      toast({
        title: "Key tidak valid",
        description: "Format key: XXXX-XXXX-XXXX-XXXX",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setKeyInfo(null);
    setResetAvailableAt(null);
    try {
      const data = await fetchKeyInfo(key);
      setKeyInfo(data);
      if (data.hwidResetAt) {
        const next = new Date(new Date(data.hwidResetAt).getTime() + HWID_RESET_COOLDOWN_MS);
        if (new Date() < next) setResetAvailableAt(next);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal cek key";
      setKeyInfo({ success: false, status: "error", message: msg });
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetHwid = async () => {
    const key = keyInput.trim();
    if (!key || !keyInfo?.success) return;

    setResetLoading(true);
    try {
      const res = await fetch("/api/user-reset-hwid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();

      if (res.status === 429) {
        toast({
          title: "Tunggu dulu",
          description: data.message || "Bisa reset lagi dalam 20 menit",
          variant: "destructive",
        });
        if (data.resetAvailableAt) setResetAvailableAt(new Date(data.resetAvailableAt));
        return;
      }

      if (!res.ok) {
        toast({ title: "Gagal reset", description: data.message || "Coba lagi nanti", variant: "destructive" });
        return;
      }

      toast({ title: "Berhasil", description: data.message });
      setResetAvailableAt(data.resetAvailableAt ? new Date(data.resetAvailableAt) : new Date(Date.now() + HWID_RESET_COOLDOWN_MS));
      const updated = await fetchKeyInfo(key);
      setKeyInfo(updated);
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    if (!resetAvailableAt) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const now = new Date();
      if (now >= resetAvailableAt) {
        setResetAvailableAt(null);
        setCountdown(null);
        return;
      }
      const ms = resetAvailableAt.getTime() - now.getTime();
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      setCountdown(`${minutes} menit ${seconds} detik`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetAvailableAt]);

  const canResetHwid =
    keyInfo?.success &&
    keyInfo?.status === "active" &&
    !resetAvailableAt &&
    keyInfo?.hwid;

  const statusLabel: Record<string, string> = {
    active: "Aktif",
    expired: "Kadaluarsa",
    blacklisted: "Blacklist",
    available: "Tersedia",
    sold: "Sudah dibeli",
    unused: "Tersedia",
  };
  const statusIcon: Record<string, React.ReactNode> = {
    active: <CheckCircle2 className="h-4 w-4 text-chart-2" />,
    expired: <XCircle className="h-4 w-4 text-destructive" />,
    blacklisted: <Ban className="h-4 w-4 text-destructive" />,
    available: <Clock className="h-4 w-4 text-muted-foreground" />,
    sold: <Clock className="h-4 w-4 text-muted-foreground" />,
    unused: <Clock className="h-4 w-4 text-muted-foreground" />,
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
            <Link href="/">
              <Button variant="ghost" size="sm">Home</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container flex flex-col items-center px-4 py-12 md:py-20">
        <Card className="w-full max-w-md glass">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Key className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl">Cek Key & Info License</CardTitle>
            <CardDescription>
              Masukkan License Key untuk melihat status, masa aktif, dan reset HWID (ganti device).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCekKey} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">License Key</Label>
                <Input
                  id="key"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={keyInput}
                  onChange={handleKeyChange}
                  maxLength={19}
                  className="font-mono tracking-widest text-center"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengecek...
                  </>
                ) : (
                  "Cek Key"
                )}
              </Button>
            </form>

            {keyInfo && (
              <div className="mt-6 space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <span className="flex items-center gap-2 font-medium">
                    {statusIcon[keyInfo.status] ?? <Clock className="h-4 w-4" />}
                    {statusLabel[keyInfo.status] ?? keyInfo.status}
                  </span>
                </div>

                {keyInfo.expiresAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Masa aktif
                    </span>
                    <span className="font-mono text-sm">
                      {new Date(keyInfo.expiresAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Cpu className="h-4 w-4" />
                    HWID terikat
                  </span>
                  <span className="max-w-[180px] truncate font-mono text-xs">
                    {keyInfo.hwid || "—"}
                  </span>
                </div>

                {keyInfo.status === "active" && (
                  <div className="border-t pt-4">
                    {canResetHwid ? (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={handleResetHwid}
                        disabled={resetLoading}
                      >
                        {resetLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        Reset HWID (ganti device)
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-md bg-muted/50 py-3 text-sm text-muted-foreground">
                        {resetAvailableAt && countdown ? (
                          <>
                            <Clock className="h-4 w-4" />
                            Bisa reset lagi dalam {countdown}
                          </>
                        ) : !keyInfo.hwid ? (
                          "Key belum terikat device. Pakai key di executor dulu."
                        ) : (
                          "Reset HWID"
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!keyInfo.success && (
                  <p className="text-sm text-destructive">{keyInfo.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 flex max-w-md flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>Reset HWID maksimal sekali dalam 20 menit per key.</span>
          </div>
          <Link href="/" className="text-primary hover:underline">Back to home</Link>
        </div>
      </main>
    </div>
  );
}
