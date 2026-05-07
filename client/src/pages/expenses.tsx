import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Expense } from "@shared/schema";
import { useState, useMemo } from "react";
import {
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  TrendingDown,
  Calendar,
  BarChart3,
  Search,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ViewMode = "all" | "daily" | "monthly";

function fmtINR(n: number) {
  return n.toLocaleString("en-IN");
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function formatDayLabel(dateStr: string) {
  if (!dateStr) return "";
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(dateStr + "T00:00:00");
  return `${days[d.getDay()]}, ${formatDate(dateStr)}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thisMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ExpenseForm({ onClose, initialData }: { onClose: () => void; initialData?: Expense }) {
  const { toast } = useToast();
  const today = todayStr();
  const [name, setName] = useState(initialData?.name || "");
  const [details, setDetails] = useState(initialData?.details || "");
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [date, setDate] = useState(initialData?.date || today);
  const [category, setCategory] = useState(initialData?.category || "");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      let res: Response;
      if (initialData?.id) {
        res = await apiRequest("PATCH", `/api/expenses/${initialData.id}`, data);
      } else {
        res = await apiRequest("POST", "/api/expenses", data);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.refetchQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: initialData ? "Expense updated" : "Expense added",
        description: `₹${parseFloat(price).toLocaleString("en-IN")} saved.`,
      });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error saving expense", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (!price || isNaN(parseFloat(price))) {
      toast({ title: "Valid amount required", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Date required", variant: "destructive" });
      return;
    }
    mutation.mutate({ name: name.trim(), details: details.trim(), price: parseFloat(price), date, category: category.trim() });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Expense Name *</Label>
        <Input data-testid="input-expense-name" placeholder="e.g. Electricity Bill" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Details <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <Input data-testid="input-expense-details" placeholder="e.g. Monthly electricity for workshop" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Amount (₹) *</Label>
          <Input data-testid="input-expense-price" type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} min="0" />
        </div>
        <div className="space-y-1.5">
          <Label>Date *</Label>
          <Input data-testid="input-expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Category <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <Input data-testid="input-expense-category" placeholder="e.g. Utilities, Rent, Supplies" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button data-testid="btn-save-expense" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : initialData ? "Update Expense" : "Save Expense"}
        </Button>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => thisMonthStr());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/expenses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.refetchQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const today = todayStr();
  const thisMonth = thisMonthStr();

  const totalAll = useMemo(() => expenses.reduce((s, e) => s + (e.price || 0), 0), [expenses]);
  const totalToday = useMemo(() => expenses.filter(e => e.date === today).reduce((s, e) => s + (e.price || 0), 0), [expenses, today]);
  const totalThisMonth = useMemo(() => expenses.filter(e => (e.date || "").startsWith(thisMonth)).reduce((s, e) => s + (e.price || 0), 0), [expenses, thisMonth]);

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const m = (e.date || "").substring(0, 7);
      if (m) map.set(m, (map.get(m) || 0) + (e.price || 0));
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const last6 = sorted.slice(-6);
    if (last6.length === 0) {
      const now = new Date();
      return Array.from({ length: 3 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
        return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0] as [string, number];
      });
    }
    return last6;
  }, [expenses]);

  const maxMonthly = useMemo(() => Math.max(...monthlyBreakdown.map(([, v]) => v), 1), [monthlyBreakdown]);

  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.details || "").toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q)
      );
    }
    if (viewMode === "monthly") {
      list = list.filter(e => (e.date || "").startsWith(selectedMonth));
    }
    if (fromDate) {
      list = list.filter(e => (e.date || "") >= fromDate);
    }
    if (toDate) {
      list = list.filter(e => (e.date || "") <= toDate);
    }
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [expenses, searchQuery, viewMode, selectedMonth, fromDate, toDate]);

  const dailyGroups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filteredExpenses) {
      const d = e.date || "";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredExpenses]);

  const toggleDay = (day: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const filteredTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + (e.price || 0), 0), [filteredExpenses]);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
            <p className="text-muted-foreground mt-1">Track and manage your business expenses.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-expense" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
              </DialogHeader>
              <ExpenseForm onClose={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Today</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-slate-900">₹{fmtINR(totalToday)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatDate(today)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">This Month</span>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-slate-900">₹{fmtINR(totalThisMonth)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatMonthLabel(thisMonth)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total All Time</span>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-primary">₹{fmtINR(totalAll)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Bar Chart — always visible */}
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-28">
              {monthlyBreakdown.map(([month, total]) => {
                const heightPct = total === 0 ? 4 : Math.round((total / maxMonthly) * 100);
                const isCurrentMonth = month === thisMonth;
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {total > 0 ? `₹${total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}` : "–"}
                    </span>
                    <div
                      className={`w-full rounded-t-sm transition-all ${isCurrentMonth ? "bg-primary" : "bg-primary/40"}`}
                      style={{ height: `${heightPct}%`, minHeight: "6px", maxHeight: "80px" }}
                    />
                    <span className={`text-[10px] font-medium ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                      {formatMonthLabel(month)}
                    </span>
                  </div>
                );
              })}
            </div>
            {expenses.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-2">Add your first expense to see the trend chart populate.</p>
            )}
          </CardContent>
        </Card>

        {/* View Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, details, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
                data-testid="input-search-expenses"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {(["all", "daily", "monthly"] as ViewMode[]).map(mode => (
                <Button
                  key={mode}
                  size="sm"
                  variant={viewMode === mode ? "default" : "outline"}
                  onClick={() => { setViewMode(mode); setFromDate(""); setToDate(""); }}
                  data-testid={`btn-view-${mode}`}
                >
                  {mode === "all" ? "All" : mode === "daily" ? "Day-wise" : "Month-wise"}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Filters */}
          {viewMode === "monthly" && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Month:</span>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 w-44"
              />
            </div>
          )}

          {(viewMode === "all" || viewMode === "daily") && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg flex-wrap">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Date Range:</span>
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">From</span>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-9 w-40"
                    data-testid="input-from-date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">To</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-9 w-40"
                    data-testid="input-to-date"
                  />
                </div>
                {(fromDate || toDate) && (
                  <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }} className="h-9 px-2 text-muted-foreground">
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
              {(fromDate || toDate) && (
                <span className="text-xs text-primary font-semibold ml-auto">
                  {filteredExpenses.length} result{filteredExpenses.length !== 1 ? "s" : ""} — ₹{fmtINR(filteredTotal)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expense List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
              <IndianRupee className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-muted-foreground font-medium">
              {searchQuery || fromDate || toDate ? "No expenses match your filters." : "No expenses yet. Click \"Add Expense\" to get started."}
            </p>
          </div>
        ) : viewMode === "daily" ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground px-1">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""} — Total: ₹{fmtINR(filteredTotal)}
            </div>
            {dailyGroups.map(([day, items]) => {
              const dayTotal = items.reduce((s, e) => s + (e.price || 0), 0);
              const expanded = expandedDays.has(day);
              const isToday = day === today;
              return (
                <Card key={day} className="border-slate-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => toggleDay(day)}
                    data-testid={`day-group-${day}`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-slate-800">{formatDayLabel(day)}</span>
                      {isToday && <span className="text-[10px] bg-primary text-primary-foreground rounded px-1.5 py-0.5 font-bold uppercase">Today</span>}
                      <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">₹{fmtINR(dayTotal)}</span>
                      {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="divide-y border-t">
                      {items.map(expense => (
                        <ExpenseRow key={expense.id} expense={expense} onEdit={setEditingExpense} onDelete={(id) => {
                          if (confirm("Delete this expense?")) deleteMutation.mutate(id);
                        }} />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground px-1">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""} — Total: ₹{fmtINR(filteredTotal)}
            </div>
            <div className="border rounded-md overflow-hidden divide-y">
              {filteredExpenses.map(expense => (
                <ExpenseRow key={expense.id} expense={expense} onEdit={setEditingExpense} onDelete={(id) => {
                  if (confirm("Delete this expense?")) deleteMutation.mutate(id);
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
            </DialogHeader>
            {editingExpense && (
              <ExpenseForm onClose={() => setEditingExpense(null)} initialData={editingExpense} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function ExpenseRow({ expense, onEdit, onDelete }: { expense: Expense; onEdit: (e: Expense) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors" data-testid={`expense-row-${expense.id}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 truncate">{expense.name}</span>
          {expense.category && (
            <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-medium uppercase">{expense.category}</span>
          )}
        </div>
        {expense.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{expense.details}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(expense.date)}</p>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="font-bold text-primary whitespace-nowrap">₹{fmtINR(expense.price)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(expense)} data-testid={`btn-edit-expense-${expense.id}`}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => onDelete(expense.id!)} data-testid={`btn-delete-expense-${expense.id}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
