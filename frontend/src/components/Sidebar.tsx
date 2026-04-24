import React from "react";
import { 
  Home, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Plus, 
  X,
  Lock,
  Globe,
  Terminal,
  Activity,
  Database,
  Sparkles,
  Clock
} from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

interface SidebarProps {
  isMobile: boolean;
  isSidebarOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  activePage: "projects" | "workspace";
  setActivePage: (page: "projects" | "workspace") => void;
  resetHome: () => void;
  collections: any[];
  selectedCollection: any;
  selectCollection: (coll: any) => void;
  removeCollection: (coll: any) => void;
  isCollectionRemovable: (filename: string) => boolean;
  environments: any[];
  selectedEnv: any;
  setSelectedEnv: (env: any) => void;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  credentialProfiles: any[];
  selectedCredentialProfileId: string;
  setSelectedCredentialProfileId: (id: string) => void;
  addCredentialProfile: () => void;
  removeCredentialProfile: (id: string) => void;
  selectedCredentialProfile: any;
  updateSelectedCredentialProfile: (field: any, value: string) => void;
  showActiveConfigPassword: boolean;
  setShowActiveConfigPassword: (show: boolean | ((curr: boolean) => boolean)) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobile,
  isSidebarOpen,
  setMobileMenuOpen,
  setDesktopSidebarOpen,
  activePage,
  setActivePage,
  resetHome,
  collections,
  selectedCollection,
  selectCollection,
  removeCollection,
  isCollectionRemovable,
  environments,
  selectedEnv,
  setSelectedEnv,
  baseUrl,
  setBaseUrl,
  credentialProfiles,
  selectedCredentialProfileId,
  setSelectedCredentialProfileId,
  addCredentialProfile,
  removeCredentialProfile,
  selectedCredentialProfile,
  updateSelectedCredentialProfile,
  showActiveConfigPassword,
  setShowActiveConfigPassword,
  theme,
  toggleTheme,
}) => {
  const sidebarContent = (
    <aside className={cn(
      "flex flex-col h-screen w-[320px] backdrop-blur-3xl border-r pb-6 transition-colors duration-500",
      theme === "dark" ? "bg-slate-950/40 border-white/5" : "bg-white/80 border-slate-200",
      isMobile ? "w-[280px]" : "relative"
    )}>
      {/* Header / Brand */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={resetHome}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full group-hover:bg-indigo-500/40 transition-colors" />
              <div className="relative rounded-2xl bg-indigo-500 p-2.5 text-white shadow-lg shadow-indigo-500/20">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div>
              <h1 className={cn("text-lg font-black tracking-tight", theme === "dark" ? "text-white" : "text-slate-900")}>Nexus</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">API Explorer</p>
            </div>
          </div>
          {isMobile ? (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
             <button
              onClick={() => setDesktopSidebarOpen(false)}
              className="p-2 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-all hover:scale-110"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>

        {/* Navigation */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActivePage("projects")}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200",
                activePage === "projects"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : theme === "dark" 
                    ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Home className="h-4 w-4" />
              Workspaces
            </button>
            <button
               onClick={toggleTheme}
               className={cn(
                 "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200",
                 theme === "dark"
                   ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                   : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
               )}
            >
               {theme === "dark" ? <Sparkles className="h-4 w-4 text-amber-400" /> : <Clock className="h-4 w-4 text-slate-500" />}
               {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 custom-scrollbar">
        {/* Collections Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Collections</h3>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", theme === "dark" ? "bg-slate-800/50 text-slate-400 border-white/5" : "bg-slate-100 text-slate-500 border-slate-200")}>
              {collections.length}
            </span>
          </div>
          <div className="space-y-2">
            {collections.map((coll) => (
              <div
                key={coll.filename}
                className={cn(
                  "group relative flex items-center gap-2 rounded-2xl border p-1 transition-all duration-200",
                  selectedCollection?.filename === coll.filename
                    ? (theme === "dark" ? "border-indigo-500/30 bg-indigo-500/5 shadow-sm" : "border-indigo-500/20 bg-indigo-50 shadow-sm")
                    : (theme === "dark" ? "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")
                )}
              >
                <button
                  onClick={() => selectCollection(coll)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                >
                  <div className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    selectedCollection?.filename === coll.filename
                      ? (theme === "dark" ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-500 text-white shadow-md")
                      : (theme === "dark" ? "bg-slate-800/50 text-slate-400 group-hover:text-slate-200" : "bg-slate-100 text-slate-400 group-hover:text-slate-900")
                  )}>
                    <Database className="h-3.5 w-3.5" />
                  </div>
                  <span className={cn(
                    "truncate text-xs font-bold transition-colors",
                    selectedCollection?.filename === coll.filename
                      ? (theme === "dark" ? "text-indigo-200" : "text-indigo-600")
                      : (theme === "dark" ? "text-slate-400 group-hover:text-slate-200" : "text-slate-500 group-hover:text-slate-900")
                  )}>
                    {coll.name}
                  </span>
                </button>
                {isCollectionRemovable(coll.filename) && (
                  <button
                    onClick={() => removeCollection(coll)}
                    className="mr-1 rounded-xl p-2 text-slate-500 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100"
                    title="Delete connection"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Global Config Section */}
        <section>
          <h3 className={cn("text-[10px] font-bold uppercase tracking-[0.3em] mb-4 px-1", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Environments</h3>
          
          <div className={cn("space-y-4 p-4 rounded-2xl border shadow-inner", theme === "dark" ? "bg-white/[0.03] border-white/5" : "bg-slate-50 border-slate-200")}>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Active Env</label>
              <div className="relative group">
                <Globe className="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-indigo-400" />
                <select
                  value={selectedEnv?.filename || ""}
                  onChange={(e) => setSelectedEnv(environments.find(env => env.filename === e.target.value) || null)}
                  className={cn(
                    "w-full appearance-none rounded-xl border py-2.5 pl-10 pr-10 text-xs font-bold outline-none transition-all",
                    theme === "dark"
                      ? "bg-slate-900/50 border-white/5 text-slate-200 hover:bg-slate-900/80 focus:border-indigo-500/50"
                      : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5"
                  )}
                >
                  {environments.map((env) => (
                    <option key={env.filename} value={env.filename}>{env.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-3 h-3.5 w-3.5 text-slate-600" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Target Base URL</label>
              <div className="relative group">
                <Terminal className="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-indigo-400" />
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className={cn(
                    "w-full rounded-xl border py-2.5 pl-10 pr-4 text-xs font-bold outline-none transition-all",
                    theme === "dark"
                      ? "bg-slate-900/50 border-white/5 text-slate-200 hover:bg-slate-900/80 focus:border-indigo-500/50 placeholder:text-slate-700"
                      : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder:text-slate-300"
                  )}
                  placeholder="https://api.nexus-explorer.com"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Credentials / Auth Profiles Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Auth Profiles</h3>
            <button 
              onClick={addCredentialProfile}
              className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <select
                value={selectedCredentialProfileId}
                onChange={(e) => setSelectedCredentialProfileId(e.target.value)}
                className={cn(
                  "w-full appearance-none rounded-xl border py-2.5 pl-4 pr-10 text-xs font-bold text-indigo-300 outline-none transition-all",
                  theme === "dark" ? "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]" : "border-slate-200 bg-white hover:bg-slate-50 text-indigo-600"
                )}
              >
                {credentialProfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role || "No role"})</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3 h-3.5 w-3.5 text-indigo-500/50" />
            </div>

            {selectedCredentialProfile && (
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-500/[0.02] border border-indigo-500/10 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-2">
                  <button 
                    onClick={() => removeCredentialProfile(selectedCredentialProfileId)}
                    className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                  <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Profile Label</label>
                    <input
                      value={selectedCredentialProfile.name}
                      onChange={(e) => updateSelectedCredentialProfile("name", e.target.value)}
                      className={cn(
                        "w-full bg-transparent border-b py-1 text-xs font-bold outline-none transition-colors",
                        theme === "dark" ? "border-white/5 text-white focus:border-indigo-500/50" : "border-slate-200 text-slate-900 focus:border-indigo-500"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">System Role</label>
                    <input
                      value={selectedCredentialProfile.role}
                      onChange={(e) => updateSelectedCredentialProfile("role", e.target.value)}
                      className={cn(
                        "w-full bg-transparent border-b py-1 text-xs font-bold outline-none transition-colors",
                        theme === "dark" ? "border-white/5 text-white focus:border-indigo-500/50" : "border-slate-200 text-slate-900 focus:border-indigo-500"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Identifier / Username</label>
                    <input
                      value={selectedCredentialProfile.username}
                      onChange={(e) => updateSelectedCredentialProfile("username", e.target.value)}
                      className={cn(
                        "w-full bg-transparent border-b py-1 text-xs font-bold outline-none transition-colors",
                        theme === "dark" ? "border-white/5 text-slate-300 focus:border-indigo-500/50" : "border-slate-200 text-slate-700 focus:border-indigo-500"
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Security Key / Password</label>
                    <div className="relative">
                      <input
                        type={showActiveConfigPassword ? "text" : "password"}
                        value={selectedCredentialProfile.password}
                        onChange={(e) => updateSelectedCredentialProfile("password", e.target.value)}
                        className={cn(
                          "w-full bg-transparent border-b py-1 pr-8 text-xs font-bold outline-none transition-colors",
                          theme === "dark" ? "border-white/5 text-slate-300 focus:border-indigo-500/50" : "border-slate-200 text-slate-700 focus:border-indigo-500"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowActiveConfigPassword(p => !p)}
                        className="absolute right-0 top-0.5 text-slate-600 hover:text-indigo-400"
                      >
                        <Lock className={cn("h-3 w-3", showActiveConfigPassword && "text-indigo-400")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-auto px-6 py-4">
        <div className={cn("rounded-2xl border p-4", theme === "dark" ? "border-white/5 bg-white/[0.02]" : "border-slate-200 bg-slate-50")}>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={cn("text-[10px] font-bold uppercase tracking-widest", theme === "dark" ? "text-slate-400" : "text-slate-500")}>System Online</span>
          </div>
          <p className="text-[9px] text-slate-500">Dashboard v3.45.2-stable</p>
        </div>
      </div>
    </aside>
  );

  return (
    <AnimatePresence>
      {(isMobile && isSidebarOpen) ? (
        createPortal(
          <div className="fixed inset-0 z-[100] flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full w-[280px]"
            >
              {sidebarContent}
            </motion.div>
          </div>,
          document.body
        )
      ) : (
        !isMobile && isSidebarOpen && sidebarContent
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
