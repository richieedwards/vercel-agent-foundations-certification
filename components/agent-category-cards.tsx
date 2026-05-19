"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { CategoryListToolInvocation } from "@/lib/agent";
import { AgentCategoryCard } from "./agent-category-card";

interface AgentCategoryCardsProps {
  invocation: CategoryListToolInvocation;
}

export function AgentCategoryCards({ invocation }: AgentCategoryCardsProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Finding all categories
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  const output = invocation.output;

  if (!output) return null;

  if ("error" in output) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error as string}
      </div>
    );
  }

  return (
    <>
      <h2>All Categories</h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {output.categories.map((category) => (
          <AgentCategoryCard key={category.name} category={category} />
        ))}
      </div>
    </>
  );
}