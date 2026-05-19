"use client";

import Link from "next/link";
import type { CategoryListToolInvocation } from "@/lib/agent";
import { Category } from "@/lib/types";

interface AgentCategoryCardProps {
  category: Category;
}

export function AgentCategoryCard({ category }: AgentCategoryCardProps) {
  
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold leading-tight">
              {category.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Number of items: {category.productCount}
            </p>
          </div>
        </div>
        <Link
          href={`/categories/${category.slug}`}
          className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View category →
        </Link>
      </div>
    </div>
  );
}