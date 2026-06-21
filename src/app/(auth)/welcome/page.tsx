"use client";

import { useRouter } from "next/navigation";
import { Briefcase, ChevronRight, User, Zap } from "lucide-react";

import type { Role } from "@/lib/validation/auth";

const ROLE_CARDS: {
  role: Role;
  title: string;
  blurb: string;
  tags: string[];
  icon: typeof User;
}[] = [
  {
    role: "worker",
    title: "I want to work",
    blurb: "Find shifts near you. Get paid the same day. Build your reputation in Dhaka.",
    tags: ["Waiter", "Promoter", "Event Staff", "Production"],
    icon: User,
  },
  {
    role: "business",
    title: "I need workers",
    blurb: "Post a shift. Get qualified workers within minutes. Run your event smoothly.",
    tags: ["Restaurant", "Events", "Retail", "Corporate"],
    icon: Briefcase,
  },
];

/**
 * Unauthenticated landing (auth flow screen 1). The user picks a role, which is
 * carried to the phone screen as `/login?role=<role>`.
 */
export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col py-12">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand shadow-sm">
          <Zap size={30} className="text-ink" fill="currentColor" />
        </span>
        <h1 className="mt-5 text-3xl font-bold text-ink">
          Welcome to <span className="text-emerald">Workforce</span>
        </h1>
        <p className="mt-2 max-w-xs text-[15px] leading-6 text-text-secondary">
          One platform. Built for Dhaka. How do you want to use it?
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {ROLE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.role}
              onClick={() => router.push(`/login?role=${card.role}`)}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-ink/30 active:scale-[0.99]"
            >
              <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light">
                <Icon size={24} className="text-ink" />
              </span>
              <span className="flex-1">
                <span className="flex items-center justify-between">
                  <span className="text-lg font-bold text-ink">{card.title}</span>
                  <ChevronRight size={18} className="text-text-tertiary" />
                </span>
                <span className="mt-1 block text-[14px] leading-5 text-text-secondary">
                  {card.blurb}
                </span>
                <span className="mt-3 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-cream px-3 py-1 text-[12px] font-medium text-text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-auto pt-8 text-center text-[13px] text-text-tertiary">
        Bangladesh phone numbers only (+880)
      </p>
    </div>
  );
}
