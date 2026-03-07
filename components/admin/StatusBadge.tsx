"use client";

/** Status values shared by posts and products. */
export type ContentStatus = "draft" | "published" | "pending_review";

type StatusBadgeProps = {
  status: ContentStatus | string | null | undefined;
  /** When status is "published", if set and in the future, show "Scheduled" with blue pill. */
  publishedAt?: string | null;
};

const PILL_CLASS = "rounded-full px-2 py-0.5 text-xs font-medium";

export function StatusBadge({ status, publishedAt }: StatusBadgeProps) {
  const s = (status ?? "draft") as ContentStatus;
  const isScheduled =
    s === "published" &&
    publishedAt &&
    new Date(publishedAt) > new Date();

  if (isScheduled) {
    return (
      <span className={`${PILL_CLASS} bg-blue-500/20 text-blue-400`}>
        Scheduled
      </span>
    );
  }
  if (s === "published") {
    return (
      <span className={`${PILL_CLASS} bg-green-500/20 text-green-400`}>
        Published
      </span>
    );
  }
  if (s === "pending_review") {
    return (
      <span className={`${PILL_CLASS} bg-amber-500/20 text-amber-400`}>
        Pending Review
      </span>
    );
  }
  return (
    <span className={`${PILL_CLASS} bg-gray-500/20 text-gray-400`}>
      Draft
    </span>
  );
}
