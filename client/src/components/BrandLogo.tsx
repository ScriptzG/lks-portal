import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The LKS Systems logo, wherever it appears in the chrome (login page, admin sidebar, client
 * header). Shows the real uploaded logo (Settings → Branding) once one exists; falls back to a
 * lettermark placeholder otherwise so there's always something reasonable on screen. This is the
 * one place that fallback lives — every layout should render this instead of hardcoding the "L".
 */
export function BrandLogo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const { data } = useQuery({ queryKey: ["settings", "branding"], queryFn: api.settings.branding, staleTime: 60_000 });

  const dimensions = size === "sm" ? "h-8 w-8 text-sm" : size === "lg" ? "h-12 w-12 text-xl" : "h-8 w-8 text-sm";

  if (data?.brandLogoUrl) {
    return (
      <img
        src={data.brandLogoUrl}
        alt="LKS Systems"
        className={cn(dimensions, "shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        dimensions,
        "flex shrink-0 items-center justify-center rounded-lg bg-brand-violet-500 font-display font-bold text-black",
        className,
      )}
    >
      L
    </div>
  );
}
