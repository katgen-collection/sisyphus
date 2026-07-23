"use client";

import Image from "next/image";
import { useState } from "react";

interface SpinningLogoProps {
  size?: number;
  className?: string;
  /** Enable hover/tap to toggle spinning (for interactive use like homepage) */
  spinOnHover?: boolean;
  /** Force continuous spinning (for loading states) */
  spinning?: boolean;
}

/**
 * Spinning logo component - the boulder that Sisyphus rolls.
 * - spinOnHover: Hover to start spinning, unhover to stop. Tap to spin, untap to stop.
 * - spinning: Force continuous slow spin (for loading states).
 */
export function SpinningLogo({
  size = 128,
  className = "",
  spinOnHover = true,
  spinning = false,
}: SpinningLogoProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  const shouldSpin = spinning || (spinOnHover && (isHovering || isTouching));

  return (
    <div
      className={`relative select-none ${spinOnHover ? "cursor-pointer" : ""} ${className}`}
      onMouseEnter={() => spinOnHover && setIsHovering(true)}
      onMouseLeave={() => spinOnHover && setIsHovering(false)}
      onTouchStart={() => spinOnHover && setIsTouching(true)}
      onTouchEnd={() => spinOnHover && setIsTouching(false)}
      onTouchCancel={() => spinOnHover && setIsTouching(false)}
      role="img"
      aria-label="Sisyphus logo - spinning boulder"
    >
      <Image
        src="/assets/logo/logo-transparent-512.png"
        alt="Sisyphus"
        width={size}
        height={size}
        className={shouldSpin ? "animate-spin-slow" : ""}
        draggable={false}
        priority
      />
    </div>
  );
}
