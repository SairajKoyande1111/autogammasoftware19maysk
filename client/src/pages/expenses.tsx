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
import { format, parseISO, startOfMonth, endOfMonth, isSameMonth, isSameDay } from "date-fns";

type ViewMode = "all" | "daily" | "monthly";

function ExpenseForm({
  onClose,
  initialData,
}: {
  onClose: () => void;
  initialData?: Expense;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [name, setName] = useState(initialData?.name || "");
  const [details, setDetails] = useState(initialData?.details || "");
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [date, setDate] = useState(initialData?.date || today);
  const [category, setCategory] = useState(initialData?.category || "");

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (initialData?.id) {
        return apiRequest("PATCH", `/api/expenses/${initialData.id}`, data);
      }
      return apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: initialData ? "Expense updated" : "Expense added",
        description: `₹${price} expense saved successfully.`,
      });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save expense.", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!name.trim() || !price || !date) {
      toast({ title: "Required fields missing", description: "Name, price and date are required.", variant: "destructive" });
      return;
    }
    mutation.mutate({ name: name.trim(), details: details.trim(), price: parseFloat(price) || 0, date, category: category.trim() });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Expense Name *</Label>
        <Input placeholder="e.g. Electricity Bill" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Details <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <Input placeholder="e.g. Monthly electricity for workshop" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Amount (₹) *</Label>
          <Input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} min="0" />
        </div>
        <div className="space-y-1.5">
          <Label>Date *</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Category <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <Input placeholder="e.g. Utilities, Rent, Supplies" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={mutation.isPending}>
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
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
  });

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const thisMonth = format(today, "yyyy-MM");

  const totalAll = useMemo(() => expenses.reduce((s, e) => s + e.price, 0), [expenses]);
  const totalToday = useMemo(() => expenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.price, 0), [expenses, todayStr]);
  const totalThisMonth = useMemo(() => expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + e.price, 0), [expenses, thisMonth]);

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      const m = e.date?.substring(0, 7) || "";
      if (m) map.set(m, (map.get(m) || 0) + e.price);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  }, [expenses]);

  const maxMonthly = useMemo(() => Math.max(...monthlyBreakdown.map(([, v]) => v), 1), [monthlyBreakdown]);

  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.details?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q));
    }
    if (viewMode === "monthly") {
      list = list.filter(e => e.date?.startsWith(selectedMonth));
    }
    return list;
  }, [expenses, searchQuery, viewMode, selectedMonth]);

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

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
            <p className="text-muted-foreground mt-1">Track and manage your business expenses.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
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
              <div className="text-2xl font-bold text-slate-900">₹{totalToday.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{format(today, "dd MMM yyyy")}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">This Month</span>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-slate-900">₹{totalThisMonth.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{format(today, "MMMM yyyy")}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-muted-foreground">Total All Time</span>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-primary">₹{totalAll.toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{expenses.length} expenses</div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Bar Chart */}
        {monthlyBreakdown.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Monthly Trend (Last 6 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-28">
                {monthlyBreakdown.slice().reverse().map(([month, total]) => {
                  const heightPct = Math.round((total / maxMonthly) * 100);
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">₹{total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}</span>
                      <div className="w-full rounded-t-sm bg-primary/80" style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: "6px", maxHeight: "80px" }} />
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(`${month}-01`), "MMM yy")}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* View Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, details, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
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
                onClick={() => setViewMode(mode)}
                className="capitalize"
              >
                {mode === "all" ? "All" : mode === "daily" ? "Day-wise" : "Month-wise"}
              </Button>
            ))}
          </div>
          {viewMode === "monthly" && (
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 w-44"
            />
          )}
        </div>

        {/* Expense List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {searchQuery ? "No expenses match your search." : "No expenses yet. Add your first expense above."}
          </div>
        ) : viewMode === "daily" ? (
          <div className="space-y-3">
            {dailyGroups.map(([day, items]) => {
              const dayTotal = items.reduce((s, e) => s + e.price, 0);
              const expanded = expandedDays.has(day);
              let label = day;
              try { label = format(parseISO(day), "EEEE, dd MMM yyyy"); } catch {}
              return (
                <Card key={day} className="border-slate-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => toggleDay(day)}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-slate-800">{label}</span>
                      <span className="text-xs text-muted-foreground">{items.length} expense{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">₹{dayTotal.toLocaleString("en-IN")}</span>
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
        ) : viewMode === "monthly" ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground px-1">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""} — Total: ₹{filteredExpenses.reduce((s, e) => s + e.price, 0).toLocaleString("en-IN")}
            </div>
            <div className="border rounded-md overflow-hidden divide-y">
              {filteredExpenses.map(expense => (
                <ExpenseRow key={expense.id} expense={expense} onEdit={setEditingExpense} onDelete={(id) => {
                  if (confirm("Delete this expense?")) deleteMutation.mutate(id);
                }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden divide-y">
            {filteredExpenses.map(expense => (
              <ExpenseRow key={expense.id} expense={expense} onEdit={setEditingExpense} onDelete={(id) => {
                if (confirm("Delete this expense?")) deleteMutation.mutate(id);
              }} />
            ))}
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
  let dateLabel = expense.date;
  try { dateLabel = format(parseISO(expense.date), "dd MMM yyyy"); } catch {}

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
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
        <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>
      <div className="flex items-center gap-3 ml-4">
        <span className="font-bold text-primary whitespace-nowrap">₹{expense.price.toLocaleString("en-IN")}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(expense)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" onClick={() => onDelete(expense.id!)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
