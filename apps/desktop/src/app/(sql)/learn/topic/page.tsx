"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionListContent } from "@/features/learn/QuestionListContent";

export default function TopicPage(): React.ReactElement {
  return (
    <Suspense>
      <TopicInner />
    </Suspense>
  );
}

function TopicInner(): React.ReactElement {
  const params = useSearchParams();
  return (
    <QuestionListContent
      source={{ kind: "topic", id: params.get("id") ?? "" }}
    />
  );
}
