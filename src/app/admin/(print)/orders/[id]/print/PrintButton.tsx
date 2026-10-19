"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/admin/ui";

export function PrintButton() {
  return (
    <Button icon={Printer} onClick={() => window.print()}>
      Принтирай
    </Button>
  );
}
