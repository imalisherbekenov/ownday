"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTelegram } from "./telegram-provider";

const nestedRoutes = [
  /^\/habits\/new$/,
  /^\/habits\/[^/]+\/edit$/,
  /^\/habit\/[^/]+$/,
  /^\/templates$/,
];

export function MiniAppBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { webApp } = useTelegram();
  const nested = nestedRoutes.some((route) => route.test(pathname));

  useEffect(() => {
    if (!webApp || !nested) return;
    const goBack = () => {
      if (window.history.length <= 1) router.replace("/");
      else router.back();
    };
    webApp.BackButton.onClick(goBack);
    webApp.BackButton.show();
    return () => {
      webApp.BackButton.offClick(goBack);
      webApp.BackButton.hide();
    };
  }, [nested, router, webApp]);

  return null;
}
