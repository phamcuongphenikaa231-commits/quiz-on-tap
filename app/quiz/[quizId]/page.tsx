import { requireUser } from "@/lib/auth/require-user";
import { requireDevice } from "@/lib/device/require-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import QuizPageClient from "./quiz-page-client";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const { user, supabase } = await requireUser();
  await requireDevice();

  const admin = createAdminClient();

  // Lấy quiz và subject slug
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, subject_id, is_published")
    .eq("id", quizId)
    .single();

  if (!quiz || !quiz.is_published) {
    notFound();
  }

  // Kiểm tra quyền môn
  const { data: access } = await supabase
    .from("user_subjects")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("subject_id", quiz.subject_id)
    .eq("is_active", true)
    .single();

  if (!access) {
    notFound();
  }

  // Lấy subject slug để navigate back
  const { data: subject } = await admin
    .from("subjects")
    .select("slug")
    .eq("id", quiz.subject_id)
    .single();

  return (
    <QuizPageClient
      quizId={quizId}
      subjectSlug={subject?.slug || ""}
    />
  );
}
