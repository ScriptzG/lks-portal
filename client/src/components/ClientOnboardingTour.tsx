import { useState } from "react";
import { MousePointerClick, MessageCircle, LifeBuoy, FolderOpen, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to your Client Portal",
    body: "This is where you'll edit your website, talk to the LKS Systems team, and keep track of everything in one place. Quick tour — takes about 30 seconds.",
  },
  {
    icon: MousePointerClick,
    title: "Click anything on your site to edit it",
    body: "Open your website from the dashboard, then just click any text or image right on the page — no code, no forms. Type your change and it saves automatically as you go.",
  },
  {
    icon: LifeBuoy,
    title: "Need something changed or fixed?",
    body: "Open a Support ticket any time — give it a subject and a priority, and the LKS Systems team will reply right there in the same thread.",
  },
  {
    icon: MessageCircle,
    title: "Messages & Documents",
    body: "Messages is your direct line to LKS Systems for anything ongoing. Documents is where contracts, invoices, and files get shared back and forth.",
  },
];

export function ClientOnboardingTour() {
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = user?.role === "client" && !user.tutorialSeenAt && !dismissed;

  async function finish() {
    setDismissed(true);
    try {
      await api.auth.markTutorialSeen();
      await refresh();
    } catch {
      // non-critical — worst case the tour shows again next login, not worth surfacing an error
    }
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <Dialog open={shouldShow} onOpenChange={(open) => !open && finish()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-violet-100 text-brand-violet-600">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-900">{current.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{current.body}</p>
          </div>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-brand-violet-600" : "w-1.5 bg-gray-200")}
              />
            ))}
          </div>

          <div className="flex w-full items-center justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
            <Button size="sm" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
              {isLast ? "Get started" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
