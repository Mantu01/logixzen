"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QuestionDetailContent } from "@/features/learn/QuestionDetailContent";

export default function PracticePage(): React.ReactElement {
  return (
    <Suspense>
      <PracticeInner />
    </Suspense>
  );
}

function PracticeInner(): React.ReactElement {
  const params = useSearchParams();
  const topicId = params.get("topic") ?? "";
  const questionId = params.get("q") ?? "";
  return <QuestionDetailContent topicId={topicId} questionId={questionId} />;
}
