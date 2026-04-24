import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, Lock, Eye, EyeOff, LogIn, BarChart3, Target, PieChart, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso — Lottery Analysis System" },
      { name: "description", content: "Smart Analytics. Better Insights. Greater Wins." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. Ask admin for roles.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex w-full relative bg-[#1c3a16] overflow-hidden">
      {/* Fallback CSS Background with gradient meshes to emulate the wavy green look */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#418523] via-[#1E431B] to-[#0A1A08]">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/lottery-bg.png')] bg-cover bg-center opacity-100 mix-blend-overlay" />
        {/* Glow effect */}
        <div className="absolute -bottom-64 -left-64 w-[600px] h-[600px] bg-[#66C52A] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse" />
      </div>

      {/* Main content container */}
      <div className="relative z-10 w-full flex min-h-screen">
        
        {/* Left Panel: Text & Branding */}
        <div className="hidden lg:flex flex-col justify-center w-1/2 px-16 xl:px-24 text-white">
          <div className="animate-in fade-in slide-in-from-left-8 duration-1000 delay-300 fill-mode-both">
            <h1 className="text-6xl xl:text-7xl font-black italic tracking-tighter mb-2 leading-[0.9]">
              LOTTERY <br />
              <span className="text-[#A2F044]">ANALYSIS SYSTEM</span>
            </h1>
            <p className="text-xl font-medium text-white/90 mt-6 tracking-wide">
              Smart Analytics. Better Insights. Greater Wins.
            </p>
          </div>
        </div>

        {/* Right Panel: Form Card */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
          <div className="bg-white w-full max-w-[500px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col justify-between py-12 px-8 sm:px-12 min-h-[700px] relative animate-in zoom-in-95 fade-in duration-700">
            
            {/* Logo Area */}
            <div className="flex flex-col items-center mb-10 mt-4">
              <div className="relative size-24 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-[#458B24] opacity-20" />
                <div className="absolute inset-0 rounded-full border-4 border-[#458B24] border-t-transparent border-r-transparent rotate-45" />
                <div className="absolute inset-0 flex items-center justify-center text-[#458B24]">
                  <BarChart3 className="size-10 stroke-[2.5]" />
                  <div className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                    <User className="size-4 stroke-[3]" />
                  </div>
                </div>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none">LOTTERY</h2>
              <p className="text-[11px] tracking-[0.2em] font-semibold text-[#458B24] uppercase mt-1">Analysis System</p>
              <div className="w-2 h-2 rounded-full bg-[#458B24] mt-6" />
            </div>

            {/* Form */}
            <div className="flex-1">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                  {/* Username/Email Input */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#458B24] transition-colors">
                      <User className="h-[18px] w-[18px]" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#458B24]/20 focus:border-[#458B24] transition-all bg-slate-50/50 hover:bg-slate-50 text-sm font-medium"
                      placeholder="Username or Email"
                    />
                  </div>

                  {/* Password Input */}
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#458B24] transition-colors">
                      <Lock className="h-[18px] w-[18px]" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#458B24]/20 focus:border-[#458B24] transition-all bg-slate-50/50 hover:bg-slate-50 text-sm font-medium"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#458B24] hover:bg-[#38721c] active:scale-[0.98] text-white text-sm font-bold tracking-wide shadow-[0_8px_16px_rgba(69,139,36,0.25)] transition-all flex items-center justify-center gap-2 group mt-2"
                >
                  {busy ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="size-[18px] transition-transform group-hover:translate-x-1" />
                      {mode === "signin" ? "LOGIN" : "SIGN UP"}
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                {mode === "signin" ? (
                  <button type="button" className="text-[13px] font-semibold text-[#458B24] hover:text-[#2d5c17] underline-offset-4 hover:underline transition-all">
                    Forgot password?
                  </button>
                ) : null}
              </div>
              
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                  className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Login"}
                </button>
              </div>
            </div>

            {/* Bottom Features */}
            <div className="pt-8 mt-4">
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-8 w-full">
                <div className="flex flex-col items-center text-center gap-2.5">
                  <Activity className="size-[22px] text-[#458B24]" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Advanced<br />Analytics</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2.5">
                  <Target className="size-[22px] text-[#458B24]" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Smart<br />Predictions</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2.5">
                  <PieChart className="size-[22px] text-[#458B24]" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Data Driven<br />Insights</span>
                </div>
              </div>
              <p className="text-center text-[11px] text-slate-400 mt-8 font-medium">
                © {new Date().getFullYear()} Lottery Analysis System. All rights reserved.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
