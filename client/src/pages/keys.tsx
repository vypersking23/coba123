import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Ban,
  RotateCcw,
  Copy,
  Download,
  Plus,
  Loader2,
  Key,
  ChevronLeft,
  ChevronRight,
  User,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Key as KeyType } from "@shared/schema";

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-chart-2 text-white">Active</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "available":
    case "unused":
      return <Badge variant="secondary">Available</Badge>;
    case "sold":
      return <Badge variant="outline">Sold</Badge>;
    case "blacklisted":
      return <Badge variant="outline" className="border-destructive text-destructive">Blacklisted</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PAGE_SIZE = 20;

interface KeysResponse {
  keys: KeyType[];
  total: number;
}

export default function Keys() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<KeyType | null>(null);
  const [actionType, setActionType] = useState<"delete" | "blacklist" | "reset" | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<KeysResponse>({
    queryKey: ["/api/keys", page, PAGE_SIZE, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        status: statusFilter,
        search: search,
      });
      const res = await fetch(`/api/keys?${params}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const keys = data?.keys ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "Key deleted successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to delete key",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/keys/${id}/blacklist`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "Key blacklisted successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to blacklist key",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/keys/${id}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
      toast({ title: "Key HWID reset successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "Failed to reset key",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleAction = (key: KeyType, action: "delete" | "blacklist" | "reset") => {
    setSelectedKey(key);
    setActionType(action);
    setDeleteDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedKey || !actionType) return;
    
    switch (actionType) {
      case "delete":
        deleteMutation.mutate(selectedKey.id);
        break;
      case "blacklist":
        blacklistMutation.mutate(selectedKey.id);
        break;
      case "reset":
        resetMutation.mutate(selectedKey.id);
        break;
    }
  };

  const exportToCSV = () => {
    if (!keys.length) return;

    const headers = ["Key Code", "Status", "Roblox User", "Executions", "Duration", "Price", "Created", "Activated", "Expires", "HWID", "Notes"];
    const rows = keys.map((key) => [
      key.keyCode,
      key.status,
      key.robloxUsername ?? "",
      String(key.executionCount ?? 0),
      `${key.durationMonths} months`,
      `$${key.price}`,
      formatDate(key.createdAt),
      formatDate(key.activatedAt),
      formatDate(key.expiresAt),
      key.hwid || "",
      key.notes || "",
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keys-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: "Keys exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide" data-testid="text-page-title">
            Key Management
          </h1>
          <p className="text-muted-foreground">
            Manage all your generated keys
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportToCSV} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/kings/generate">
            <Button data-testid="button-generate-new">
              <Plus className="mr-2 h-4 w-4" />
              Generate Keys
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                All Keys
              </CardTitle>
              <CardDescription>
                {total} key{total !== 1 ? "s" : ""} total
                {total > 0 && (
                  <> · Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)}</>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search keys..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-64 pl-9"
                    data-testid="input-search-keys"
                  />
                </div>
                <Button type="submit" variant="secondary">Search</Button>
              </form>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keys.length ? (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="whitespace-nowrap">Roblox User</TableHead>
                    <TableHead className="whitespace-nowrap">Executions</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>HWID</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-medium tracking-wider">
                            {key.keyCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(key.keyCode)}
                            data-testid={`button-copy-key-${key.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(key.status)}</TableCell>
                      <TableCell>
                        {key.robloxUsername ? (
                          <span className="flex items-center gap-1.5 font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {key.robloxUsername}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Play className="h-3.5 w-3.5 text-muted-foreground" />
                          {key.executionCount ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>{key.durationMonths} month{key.durationMonths > 1 ? "s" : ""}</TableCell>
                      <TableCell>${key.price}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(key.expiresAt)}</TableCell>
                      <TableCell>
                        {key.hwid ? (
                          <code className="text-xs text-muted-foreground">
                            {key.hwid.slice(0, 12)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${key.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyToClipboard(key.keyCode)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Key
                            </DropdownMenuItem>
                            {key.hwid && (
                              <DropdownMenuItem onClick={() => handleAction(key, "reset")}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset HWID
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {key.status !== "blacklisted" && (
                              <DropdownMenuItem
                                onClick={() => handleAction(key, "blacklist")}
                                className="text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Blacklist
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleAction(key, "delete")}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                        onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
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
                            onClick={(e) => { e.preventDefault(); setPage(p); }}
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
                        onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Key className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">No keys found</p>
              <p className="text-sm">Generate your first key to get started</p>
              <Link href="/kings/generate">
                <Button className="mt-4" data-testid="button-generate-first">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Keys
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "delete" && "Delete Key"}
              {actionType === "blacklist" && "Blacklist Key"}
              {actionType === "reset" && "Reset HWID"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "delete" && "Are you sure you want to delete this key? This action cannot be undone."}
              {actionType === "blacklist" && "Are you sure you want to blacklist this key? The key will no longer be usable."}
              {actionType === "reset" && "Are you sure you want to reset the HWID binding? The key will be able to bind to a new device."}
              <br />
              <code className="mt-2 block font-mono text-sm">{selectedKey?.keyCode}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-action">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === "reset" ? "" : "bg-destructive text-destructive-foreground"}
              data-testid="button-confirm-action"
            >
              {(deleteMutation.isPending || blacklistMutation.isPending || resetMutation.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {actionType === "delete" && "Delete"}
              {actionType === "blacklist" && "Blacklist"}
              {actionType === "reset" && "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
