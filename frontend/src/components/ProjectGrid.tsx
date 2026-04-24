import React from "react";
import { 
  Plus, 
  FileJson, 
  Trash2, 
  ArrowRight, 
  Clock, 
  Box, 
  Search,
  LayoutGrid,
  List as ListIcon,
  Sparkles,
  Play,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

interface Collection {
  name: string;
  filename: string;
  source: string;
  updatedAt?: string;
}

interface ProjectGridProps {
  collections: Collection[];
  onSelect: (collection: Collection) => void;
  onDelete: (filename: string) => void;
  onImport: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  collections,
  onSelect,
  onDelete,
  onImport,
  theme,
  toggleTheme,
}) => {
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const filtered = collections.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className={cn("text-4xl font-black tracking-tight md:text-5xl", theme === "dark" ? "text-white" : "text-slate-900")}>
              Workspaces
            </h1>
            <p className={cn("text-lg font-medium", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              Manage your API collections and their isolated environments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className={cn(
                "p-4 rounded-2xl border transition-all shadow-lg active:scale-95",
                theme === "dark" 
                  ? "bg-slate-900 border-white/10 text-amber-400 hover:bg-slate-800" 
                  : "bg-white border-slate-200 text-amber-600 hover:bg-slate-50 shadow-slate-200"
              )}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sparkles className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </button>

            <button
              onClick={onImport}
              className="group relative inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-4 text-sm font-bold text-white transition-all hover:bg-indigo-400 shadow-xl shadow-indigo-500/20 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              New Collection
              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 group-hover:ring-white/40 transition-all" />
            </button>
          </div>
        </header>

        {/* Search and Filter Section */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search collections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full border rounded-2xl py-3 pl-12 pr-4 text-sm outline-none transition-all backdrop-blur-xl",
                theme === "dark" 
                  ? "bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10" 
                  : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5"
              )}
            />
          </div>

          <div className={cn(
            "flex items-center gap-2 border rounded-2xl p-1 backdrop-blur-xl",
            theme === "dark" ? "bg-slate-900/50 border-white/10" : "bg-white border-slate-200"
          )}>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === "grid" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-white"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === "list" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-400 hover:text-white"
              )}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collections Grid/List */}
        {filtered.length === 0 ? (
          <div className={cn(
            "rounded-[3rem] border border-dashed py-32 text-center backdrop-blur-xl",
            theme === "dark" ? "border-white/10 bg-slate-900/20" : "border-slate-200 bg-white shadow-sm"
          )}>
            <div className={cn(
              "mx-auto flex h-20 w-20 items-center justify-center rounded-3xl mb-6 border shadow-inner",
              theme === "dark" ? "bg-slate-800/50 text-slate-500 border-white/5" : "bg-slate-50 text-slate-400 border-slate-100"
            )}>
              <FileJson className="h-10 w-10" />
            </div>
            <h3 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-slate-900")}>No collections found</h3>
            <p className={cn("mt-2 max-w-sm mx-auto", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
              {search ? "No results match your search query." : "Import your first Postman collection to start testing."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((collection, idx) => (
              <motion.div
                key={collection.filename}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "group relative aspect-[4/3] rounded-[2.5rem] border p-8 flex flex-col transition-all hover:-translate-y-1 hover:shadow-2xl backdrop-blur-3xl overflow-hidden",
                  theme === "dark" 
                    ? "border-white/10 bg-slate-900/40 hover:border-indigo-500/30 hover:bg-slate-900/60 hover:shadow-indigo-500/10" 
                    : "border-slate-200 bg-white hover:border-indigo-500/30 hover:shadow-slate-200"
                )}
              >
                {/* Background Glow */}
                <div className={cn(
                  "absolute -right-20 -top-20 h-64 w-64 blur-[100px] transition-all rounded-full",
                  theme === "dark" ? "bg-indigo-500/5 group-hover:bg-indigo-500/10" : "bg-indigo-500/2 group-hover:bg-indigo-500/5"
                )} />
                
                <div className="relative flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-inner">
                      <Box className="h-7 w-7" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(collection.filename);
                      }}
                      className={cn(
                        "p-3 rounded-2xl transition-all opacity-0 group-hover:opacity-100",
                        theme === "dark" ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                      )}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className={cn(
                      "text-2xl font-black truncate transition-colors",
                      theme === "dark" ? "text-white group-hover:text-indigo-200" : "text-slate-900 group-hover:text-indigo-600"
                    )}>
                      {collection.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {collection.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : 'N/A'}
                      </span>
                      <span className={cn("h-1 w-1 rounded-full", theme === "dark" ? "bg-slate-700" : "bg-slate-300")} />
                      <span>{collection.source}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-3">
                  <button
                    onClick={() => onSelect(collection)}
                    className={cn(
                      "flex-1 relative inline-flex items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-black transition-all shadow-lg active:scale-[0.98]",
                      theme === "dark" 
                        ? "bg-white/5 border-white/10 hover:border-indigo-500/50 hover:bg-white/10 text-white" 
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-900"
                    )}
                  >
                    Workspace
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(collection);
                      }}
                      className={cn(
                        "px-4 py-2.5 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center gap-2 text-[11px] font-black uppercase tracking-wider",
                      )}
                      title="Run Collection"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Run
                    </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((collection, idx) => (
              <motion.div
                key={collection.filename}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => onSelect(collection)}
                className={cn(
                  "group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-xl",
                  theme === "dark" 
                    ? "border-white/10 bg-slate-900/40 hover:border-indigo-500/30 hover:bg-slate-900/60" 
                    : "border-slate-200 bg-white hover:border-indigo-500/30 hover:bg-slate-50 shadow-sm"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Box className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={cn(
                      "text-lg font-bold transition-colors",
                      theme === "dark" ? "text-white group-hover:text-indigo-200" : "text-slate-900 group-hover:text-indigo-600"
                    )}>
                      {collection.name}
                    </h3>
                    <p className={cn(
                      "text-xs font-bold uppercase tracking-widest",
                      theme === "dark" ? "text-slate-500" : "text-slate-400"
                    )}>
                      {collection.source} • {collection.updatedAt ? new Date(collection.updatedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(collection.filename);
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="p-2 rounded-xl text-slate-500 group-hover:text-indigo-400 transition-all">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
