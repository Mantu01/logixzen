"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionListContent } from "@/features/learn/QuestionListContent";

export default function CategoryPage(): React.ReactElement {
  return (
    <Suspense>
      <CategoryInner />
    </Suspense>
  );
}

function CategoryInner(): React.ReactElement {
  const params = useSearchParams();
  return (
    <QuestionListContent
      source={{ kind: "category", id: params.get("id") ?? "" }}
    />
  );
}
