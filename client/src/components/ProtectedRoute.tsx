import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LoadingState } from "@/components/ui/state";

export function ProtectedRoute({ role, children }: { role: "admin" | "client"; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState label="Loading your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/portal"} replace />;

  return <>{children}</>;
}
