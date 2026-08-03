import { Loader2 } from "lucide-react";

export default function QuizLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải quiz...</p>
      </div>
    </div>
  );
}
