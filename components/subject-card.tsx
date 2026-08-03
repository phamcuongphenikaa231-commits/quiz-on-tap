import Link from "next/link";

interface SubjectCardProps {
  title: string;
  slug: string;
  description: string;
}

export function SubjectCard({ title, slug, description }: SubjectCardProps) {
  return (
    <Link
      href={`/mon/${slug}`}
      className="group block rounded-2xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
    >
      <h2 className="mb-1.5 text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}
    </Link>
  );
}
