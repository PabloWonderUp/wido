"use client";

import * as React from "react";

/** Loops the bundled pomodoro Lottie. Loaded lazily so it never runs on SSR. */
export function LottieBackground({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let anim: { destroy: () => void } | undefined;
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !ref.current) return;
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "/pomodoro-lottie.json",
      });
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return <div ref={ref} className={className} aria-hidden />;
}
