import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { BrandLogo } from "@/components/BrandLogo";
import { GlassBackground } from "@/components/GlassBackground";

export function AcceptInvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.auth.getInvite(token),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await api.auth.acceptInvite(token, password);
      await refresh();
      navigate("/portal");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      <GlassBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" className="shadow-glow" />
          <div>
            <h1 className="font-display text-xl font-semibold text-brand-off">Welcome to LKS Systems</h1>
            <p className="text-sm text-gray-400">Set a password to activate your account</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-lifted backdrop-blur-2xl">
          {isLoading && <LoadingState label="Checking invite…" />}
          {isError && <ErrorState message="This invite link is invalid or has expired." />}
          {invite && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <p className="text-sm text-gray-400">Invited email</p>
                <p className="text-sm font-medium text-white">{invite.email}</p>
                {invite.companyName && <p className="text-xs text-gray-500">{invite.companyName}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-gray-300">
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm" className="text-gray-300">
                  Confirm password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" loading={loading} className="mt-2 h-10 w-full bg-brand-violet-500 hover:bg-brand-violet-600">
                Activate account
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
