"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { House, Heart } from "@phosphor-icons/react";

import { UserNav } from "@/components/navigation/UserNav";
import { User } from "next-auth";

interface MainNavProps {
  user?: User;
}

import { useState, useEffect } from "react";

export function MainNav({ user }: MainNavProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMyClassroomActive =
    pathname === "/" ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/blueprint");

  if (!mounted) {
    return (
      <div className="mb-6 rounded-qc-lg border border-qc-border-subtle/50 bg-white shadow-qc-soft">
        <div className="p-4 flex items-center justify-between">
          <nav className="flex items-center gap-2 flex-wrap">
            {/* Render simplified skeleton or empty to avoid hydration mismatch */}
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex justify-between items-center gap-2 mb-2">
      <div className="flex items-center">
        <Image
          src="/assets/branding/Quill-and-Compass.png"
          alt="Quill & Compass"
          width={200}
          height={50}
          className="w-auto h-12 object-contain"
          priority
        />
      </div>

      <Button
        variant="ghost"
        size="lg"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hover:bg-transparent"
        asChild
      >
        <Link href="/">
          <House size={32} className="text-qc-primary hover:text-qc-primary/80 transition-colors" />
        </Link>
      </Button>

      {/* Family Discipleship Link */}
      <Button
        variant="ghost"
        size="lg"
        className="text-qc-primary hover:text-qc-primary/80 transition-colors"
        asChild
      >
        <Link href="/family-discipleship" title="Family Discipleship">
          <Heart size={32} />
        </Link>
      </Button>

      <div className="flex items-center gap-2">
        {user && <UserNav user={user} />}
      </div>
    </div>
  );
}

