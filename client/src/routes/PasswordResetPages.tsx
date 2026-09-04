import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { GlassBackground } from "@/components/GlassBackground";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4">
      <GlassBackground />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" className="shadow-glow" />
          <div>
            <h1 className="font-display text-xl font-semibold text-brand-off">{title}</h1>
            <p className="text-sm text-gray-400">{subtitle}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-lifted backdrop-blur-2xl">{children}</div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.auth.requestPasswordReset(email);
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a reset link">
      {sent ? (
        <p className="text-sm text-gray-300">
          If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-gray-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <Button type="submit" loading={loading} className="h-10 bg-brand-violet-500 hover:bg-brand-violet-600">
            Send reset link
          </Button>
          <Link to="/login" className="text-center text-xs text-gray-400 hover:text-gray-300">
            Back to login
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset link invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Enter a new password for your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={loading} className="h-10 bg-brand-violet-500 hover:bg-brand-violet-600">
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}
