"use client";

import Link from "next/link";
import { HabitRow, type HabitRowProps, type LinkRenderer } from "@ownday/ui";
import { useTelegram } from "./telegram-provider";

const renderLink: LinkRenderer = ({ href, children, className }) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

export function HabitRowAdapter(props: HabitRowProps) {
  const telegram = useTelegram();
  const haptic = () => telegram?.HapticFeedback?.impactOccurred("light");
  return <HabitRow {...props} renderLink={renderLink} onInteraction={haptic} />;
}
