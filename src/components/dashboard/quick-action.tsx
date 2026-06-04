import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export function QuickAction({
  title,
  description,
  icon,
  onClick,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        <div className="text-left">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors text-left w-full cursor-pointer"
    >
      {content}
    </button>
  );
}
