"use client";
import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

export function useEnsureUser() {
  const { isSignedIn } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (isSignedIn && !called.current) {
      called.current = true;
      fetch("/api/ensure-user", { method: "POST" }).catch(() => {
        setTimeout(() => {
          fetch("/api/ensure-user", { method: "POST" }).catch(() => {});
        }, 2000);
      });
    }
  }, [isSignedIn]);
}
