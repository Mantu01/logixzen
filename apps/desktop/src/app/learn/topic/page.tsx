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
  const topicId = params.get("id") ?? "";
  return <QuestionListContent topicId={topicId} />;
}
