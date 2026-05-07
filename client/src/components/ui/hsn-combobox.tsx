import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { HSN_CODES } from "@/lib/hsn-codes";

export function HsnCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [addingNew, setAddingNew] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: dbCodes = [] } = useQuery<{ id: string; code: string; description: string }[]>({
    queryKey: [api.masters.hsnCodes.list.path],
  });

  const addMutation = useMutation({
    mutationFn: (data: { code: string; description: string }) =>
      apiRequest("POST", api.masters.hsnCodes.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.masters.hsnCodes.list.path] });
    },
  });

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAddingNew(false);
        setNewDescription("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const dbCodeSet = new Set(dbCodes.map(c => c.code));
  const allCodes = [
    ...dbCodes,
    ...HSN_CODES.filter(h => !dbCodeSet.has(h.code)),
  ];

  const filtered = allCodes.filter(h =>
    !search || h.code.includes(search) || h.description.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = allCodes.some(h => h.code === search);
  const showAddNew = search.length >= 2 && !exactMatch;

  const handleConfirmAdd = () => {
    if (!newDescription.trim()) return;
    addMutation.mutate({ code: search.trim(), description: newDescription.trim() }, {
      onSuccess: () => {
        onChange(search.trim());
        setOpen(false);
        setAddingNew(false);
        setNewDescription("");
      }
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        className="h-11 text-sm"
        placeholder={placeholder || "HSN code (search or type)..."}
        value={search}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); setAddingNew(false); }}
      />
      {open && (filtered.length > 0 || showAddNew) && (
        <div className="absolute left-0 top-full mt-1 z-[9999] bg-white border border-border rounded-lg shadow-2xl max-h-64 overflow-y-auto min-w-[320px] w-full">
          {filtered.map(h => (
            <button
              key={h.code}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
              onMouseDown={e => { e.preventDefault(); onChange(h.code); setSearch(h.code); setOpen(false); }}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-xs text-red-600">{h.code}</span>
                <span className="text-xs text-muted-foreground line-clamp-1">{h.description}</span>
              </div>
            </button>
          ))}
          {showAddNew && !addingNew && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-red-50 transition-colors text-red-600 font-semibold text-xs flex items-center gap-1 border-t border-border/30"
              onMouseDown={e => { e.preventDefault(); setAddingNew(true); }}
            >
              <span className="text-base leading-none">+</span> Add "{search}" as new HSN code
            </button>
          )}
          {showAddNew && addingNew && (
            <div className="px-3 py-2 border-t border-border/30 space-y-2">
              <p className="text-xs font-semibold text-slate-600">Adding HSN code: <span className="text-red-600 font-mono">{search}</span></p>
              <Input
                autoFocus
                className="h-8 text-xs"
                placeholder="Enter description..."
                value={newDescription}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => setNewDescription(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleConfirmAdd(); } if (e.key === "Escape") { setAddingNew(false); setNewDescription(""); } }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 bg-red-600 text-white text-xs font-semibold rounded px-2 py-1 hover:bg-red-700 disabled:opacity-50"
                  onMouseDown={e => { e.preventDefault(); handleConfirmAdd(); }}
                  disabled={!newDescription.trim() || addMutation.isPending}
                >
                  {addMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 px-2 py-1 hover:text-slate-700"
                  onMouseDown={e => { e.preventDefault(); setAddingNew(false); setNewDescription(""); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
