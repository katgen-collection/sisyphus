"use client";

import { SpinningLogo } from "./SpinningLogo";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

/**
 * Loading spinner with the boulder in the center.
 * The boulder spins continuously while loading.
 */
export function LoadingSpinner({ size = "md", text }: LoadingSpinnerProps) {
  const sizes = {
    sm: { outer: 48, logo: 24, border: 3 },
    md: { outer: 80, logo: 40, border: 4 },
    lg: { outer: 120, logo: 64, border: 5 },
  };

  const { outer, logo, border } = sizes[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div 
        className="relative flex items-center justify-center"
        style={{ width: outer, height: outer }}
      >
        {/* Outer spinning ring */}
        <div 
          className="absolute inset-0 rounded-full border-stone-200 animate-spin"
          style={{ 
            borderWidth: border,
            borderTopColor: '#78716c', // stone-500
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />
        
        {/* Second ring - opposite direction */}
        <div 
          className="absolute rounded-full border-stone-100 animate-spin-reverse"
          style={{ 
            width: outer - border * 4,
            height: outer - border * 4,
            borderWidth: border - 1,
            borderTopColor: 'transparent',
            borderRightColor: '#a8a29e', // stone-400
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />

        {/* Center logo - spinning */}
        <SpinningLogo 
          size={logo} 
          spinning={true}
          spinOnHover={false}
        />
      </div>
      
      {text && (
        <p className="text-sm text-stone-500 animate-pulse">{text}</p>
      )}
    </div>
  );
}
