"use client";

import { useId, useMemo } from "react";
import { LOCK_H, LOCK_PATH, LOCK_VIEWBOX, LOCK_W, buildLock } from "@/lib/hair-lock";

type Props = {
  hex: string;
  /** Width in px; height follows the lock's 100:130 aspect. */
  size?: number;
  /** Stable key for the fibre layout; defaults to the hex. */
  seed?: string;
  /** Fewer fibres for tiny swatches keeps a page of 100 locks cheap to paint. */
  strands?: number;
  className?: string;
  title?: string;
};

const ASPECT = LOCK_H / LOCK_W;

export default function HairLock({ hex, size = 40, seed, strands, className, title }: Props) {
  const id = useId().replace(/:/g, "");
  const count = strands ?? (size < 32 ? 40 : 72);
  const m = useMemo(() => buildLock(hex, seed ?? hex, count), [hex, seed, count]);

  const clip = `c${id}`;
  const base = `b${id}`;
  const band = `g${id}`;
  const bandLow = `l${id}`;
  const mask = `m${id}`;
  const dip = `d${id}`;
  const side = `s${id}`;
  const tip = `t${id}`;

  return (
    <svg
      viewBox={LOCK_VIEWBOX}
      width={size}
      height={size * ASPECT}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flex: "none", overflow: "visible" }}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={clip}>
          <path d={LOCK_PATH} />
        </clipPath>
        <linearGradient id={base} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.shadow} />
          <stop offset="0.14" stopColor={m.base} />
          <stop offset="0.7" stopColor={m.base} />
          <stop offset="1" stopColor={m.shadow} />
        </linearGradient>
        {/* Specular band across the crown, curved like the fold of a real
            tress. Used both as a mask for the bright fibres and as a soft lift. */}
        <radialGradient
          id={band}
          gradientUnits="userSpaceOnUse"
          cx="50"
          cy="40"
          r="54"
          gradientTransform="translate(50 40) scale(1 0.3) translate(-50 -40)"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient
          id={bandLow}
          gradientUnits="userSpaceOnUse"
          cx="50"
          cy="92"
          r="40"
          gradientTransform="translate(50 92) scale(1 0.26) translate(-50 -92)"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={mask}>
          <rect width={LOCK_W} height={LOCK_H} fill={`url(#${band})`} />
          <rect width={LOCK_W} height={LOCK_H} fill={`url(#${bandLow})`} />
        </mask>
        {/* Dark band just under the highlight: glossy hair always has one. */}
        <radialGradient
          id={dip}
          gradientUnits="userSpaceOnUse"
          cx="50"
          cy="68"
          r="50"
          gradientTransform="translate(50 68) scale(1 0.22) translate(-50 -68)"
        >
          <stop offset="0" stopColor="#000" stopOpacity="0.26" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={side} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.28" stopColor="#000" stopOpacity="0" />
          <stop offset="0.74" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.24" />
        </linearGradient>
        <linearGradient id={tip} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.66" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <path
          d={LOCK_PATH}
          fill={`url(#${base})`}
          transform="translate(50 2) scale(0.94 0.965) translate(-50 -2)"
        />
        {m.strands.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.stroke}
            strokeWidth={s.width}
            strokeOpacity={s.opacity}
          />
        ))}
        <g mask={`url(#${mask})`} opacity={m.sheenAlpha}>
          <rect width={LOCK_W} height={LOCK_H} fill={m.sheen} opacity="0.28" />
          {m.highlights.map((s, i) => (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeOpacity={s.opacity}
            />
          ))}
        </g>
        <rect width={LOCK_W} height={LOCK_H} fill={`url(#${dip})`} />
        <rect width={LOCK_W} height={LOCK_H} fill={`url(#${side})`} />
        <rect width={LOCK_W} height={LOCK_H} fill={`url(#${tip})`} />
      </g>
    </svg>
  );
}
