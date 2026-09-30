"use client";

import React, { useState, useEffect } from "react";

interface CountdownRingProps {
  expiresAtIso: string;
  onExpire?: () => void;
  size?: number;
  strokeWidth?: number;
}

export function CountdownRing({
  expiresAtIso,
  onExpire,
  size = 140,
  strokeWidth = 8,
}: CountdownRingProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);

  useEffect(() => {
    const target = new Date(expiresAtIso).getTime();
    const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
    setSecondsLeft(diff);
    setInitialDuration(diff);

    const interval = setInterval(() => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsLeft(rem);

      if (rem <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAtIso, onExpire]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = initialDuration > 0 ? secondsLeft / initialDuration : 0;
  const strokeDashoffset = circumference - progress * circumference;

  const isUrgent = secondsLeft < 60;
  const strokeColor = isUrgent ? "#FF003C" : "#00F0FF";
  const glowClass = isUrgent ? "glow-red" : "glow-cyan";

  const formatTime = (secs: number) => {
    if (secs <= 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated countdown ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: "stroke-dashoffset 1s linear, stroke 0.5s ease",
            filter: `drop-shadow(0 0 6px ${strokeColor})`,
          }}
        />
      </svg>
      {/* Central counter text */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`text-2xl font-bold font-mono ${glowClass} text-white`}>
          {formatTime(secondsLeft)}
        </span>
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
          {secondsLeft <= 0 ? "EXPIRED" : "TIME LEFT"}
        </span>
      </div>
    </div>
  );
}
