import { useState } from "react";
import { cn } from "./ui";

/**
 * CMPO logo. Renders /cmpo-logo.png (drop the official PNG into
 * frontend/public/cmpo-logo.png) and falls back to the KP monogram
 * until the file exists.
 */
export default function Logo({
  size = 40,
  rounded = true,
  className,
}: {
  size?: number;
  rounded?: boolean;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-white font-extrabold text-navy-900",
          rounded && "rounded-xl",
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        KP
      </div>
    );
  }
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-white p-1", rounded && "rounded-xl", className)}
      style={{ width: size, height: size }}
    >
      <img
        src="/cmpo-logo.png"
        alt="CMPO — Chief Minister's Policy & Reform Unit"
        className="h-full w-full object-contain"
        onError={() => setMissing(true)}
      />
    </div>
  );
}
