import * as React from "react";
import { Aurora, DotGrid, BlurText } from "@/frontend/components/reactbits";
import { Logo } from "@/frontend/components/brand/logo";
import { APP } from "@/config/app.config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ------------------------------------------------------ brand panel */}
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Aurora intensity={0.42} />
        <DotGrid className="text-sidebar-foreground/25" gap={26} radius={240} />

        <div className="relative z-10">
          <Logo subtitle="Municipal Parking Authority" />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h2 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
            <BlurText text="Every kerb, accounted for." />
          </h2>
          <p className="text-base leading-relaxed text-sidebar-foreground/70 text-pretty">
            One record for every parking event — created at the kerb, priced from the approved
            tariff, evidenced with a timestamped photograph, paid through a traceable channel and
            settled on a schedule nobody has to argue about.
          </p>

          <dl className="grid grid-cols-3 gap-4 border-t border-sidebar-border pt-6">
            {[
              { k: "20", v: "Zones live" },
              { k: "1,918", v: "Bays managed" },
              { k: "100%", v: "Audit coverage" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-2xl font-semibold tracking-tight tabular">{s.k}</dt>
                <dd className="mt-0.5 text-xs text-sidebar-foreground/60">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative z-10 text-xs text-sidebar-foreground/50">
          {APP.fullName} · v{APP.version} · Phase {APP.phase}
        </p>
      </aside>

      {/* ------------------------------------------------------- form panel */}
      <main className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-0 kmcp-grid-bg opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative w-full max-w-[26rem]">{children}</div>
      </main>
    </div>
  );
}
