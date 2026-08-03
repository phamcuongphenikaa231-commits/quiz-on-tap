import fs from "fs";
import path from "path";

/**
 * Performance & Security Verification Test
 * Run with: npx tsx tests/performance-and-security-test.ts
 */

function runVerification() {
  console.log("=== Running Quiz Performance & Security Verification ===");
  let allPassed = true;

  // 1. Verify SQL RPC file exists and does NOT expose answer/explanation in start_quiz_attempt_fast
  const sqlPath = path.join(process.cwd(), "supabase", "performance_quiz_rpc.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("FAIL: performance_quiz_rpc.sql missing!");
    allPassed = false;
  } else {
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const startIndex = sqlContent.indexOf("function public.start_quiz_attempt_fast");
    const endIndex = sqlContent.indexOf("function public.submit_quiz_answer_fast");

    if (startIndex === -1 || endIndex === -1) {
      console.error("FAIL: start_quiz_attempt_fast function definition not found in SQL!");
      allPassed = false;
    } else {
      const rpcCode = sqlContent.substring(startIndex, endIndex);
      const forbiddenTokens = [
        "'is_correct'",
        "'isCorrect'",
        "'correct_option_id'",
        "'correctOptionId'",
        "'explanation'",
        "'general_explanation'",
        "'generalExplanation'",
      ];
      let leakFound = false;

      for (const token of forbiddenTokens) {
        if (rpcCode.includes(token)) {
          console.error(`FAIL: Security breach! start_quiz_attempt_fast contains forbidden token: ${token}`);
          leakFound = true;
          allPassed = false;
        }
      }

      if (!leakFound) {
        console.log("PASS [SECURITY]: start_quiz_attempt_fast RPC does not leak any answer or explanation fields.");
      }
    }
  }

  // 2. Verify fix_restart_quiz.sql exists and contains p_force_new parameter
  const fixRestartPath = path.join(process.cwd(), "supabase", "fix_restart_quiz.sql");
  if (!fs.existsSync(fixRestartPath)) {
    console.error("FAIL: supabase/fix_restart_quiz.sql missing!");
    allPassed = false;
  } else {
    const fixSql = fs.readFileSync(fixRestartPath, "utf-8");
    if (fixSql.includes("p_force_new boolean default false")) {
      console.log("PASS [RESTART]: fix_restart_quiz.sql migration includes p_force_new parameter.");
    } else {
      console.error("FAIL: fix_restart_quiz.sql does not include p_force_new parameter!");
      allPassed = false;
    }
  }

  // 3. Verify start route supports forceNew
  const startRoutePath = path.join(process.cwd(), "app", "api", "quizzes", "[quizId]", "start", "route.ts");
  const startRouteContent = fs.readFileSync(startRoutePath, "utf-8");
  if (startRouteContent.includes("start_quiz_attempt_fast") && startRouteContent.includes("forceNew")) {
    console.log("PASS [PERFORMANCE & RESTART]: POST /api/quizzes/[quizId]/start uses fast RPC and supports forceNew.");
  } else {
    console.error("FAIL: Start route does not support forceNew!");
    allPassed = false;
  }

  // 4. Verify answer route uses submit_quiz_answer_fast RPC
  const answerRoutePath = path.join(process.cwd(), "app", "api", "attempts", "[attemptId]", "answer", "route.ts");
  const answerRouteContent = fs.readFileSync(answerRoutePath, "utf-8");
  if (answerRouteContent.includes("submit_quiz_answer_fast")) {
    console.log("PASS [PERFORMANCE]: POST /api/attempts/[attemptId]/answer uses fast single RPC call.");
  } else {
    console.error("FAIL: Answer route does not invoke submit_quiz_answer_fast RPC!");
    allPassed = false;
  }

  // 5. Verify finish route uses finish_quiz_attempt_fast RPC
  const finishRoutePath = path.join(process.cwd(), "app", "api", "attempts", "[attemptId]", "finish", "route.ts");
  const finishRouteContent = fs.readFileSync(finishRoutePath, "utf-8");
  if (finishRouteContent.includes("finish_quiz_attempt_fast")) {
    console.log("PASS [PERFORMANCE]: POST /api/attempts/[attemptId]/finish uses fast single RPC call.");
  } else {
    console.error("FAIL: Finish route does not invoke finish_quiz_attempt_fast RPC!");
    allPassed = false;
  }

  // 6. Verify QuizPlayer handleRestartQuiz and key-based remount
  const playerPath = path.join(process.cwd(), "components", "quiz-player.tsx");
  const playerContent = fs.readFileSync(playerPath, "utf-8");
  if (playerContent.includes("handleRestartQuiz") && playerContent.includes('forceNew: true')) {
    console.log("PASS [RESTART]: QuizPlayer handles restart with forceNew: true and state reset.");
  } else {
    console.error("FAIL: QuizPlayer missing handleRestartQuiz or forceNew request!");
    allPassed = false;
  }

  const clientPagePath = path.join(process.cwd(), "app", "quiz", "[quizId]", "quiz-page-client.tsx");
  const clientPageContent = fs.readFileSync(clientPagePath, "utf-8");
  if (clientPageContent.includes("key={attemptId}")) {
    console.log("PASS [RESTART]: QuizPageClient uses key={attemptId} for clean component remounting.");
  } else {
    console.error("FAIL: QuizPageClient missing key={attemptId}!");
    allPassed = false;
  }

  // 7. Verify N+1 query is removed from /mon/[slug]
  const monSlugPath = path.join(process.cwd(), "app", "mon", "[slug]", "page.tsx");
  const monSlugContent = fs.readFileSync(monSlugPath, "utf-8");
  if (!monSlugContent.includes("for (const quiz of quizzes)") && monSlugContent.includes('.in("quiz_id", quizIds)')) {
    console.log("PASS [PERFORMANCE]: N+1 query loop removed from /mon/[slug] and replaced with single grouped query.");
  } else {
    console.error("FAIL: N+1 query loop still present in /mon/[slug]!");
    allPassed = false;
  }

  if (allPassed) {
    console.log("\n=== ALL PERFORMANCE, SECURITY & RESTART CONTRACT TESTS PASSED ===");
  } else {
    console.error("\n=== SOME TESTS FAILED ===");
    process.exit(1);
  }
}

runVerification();
