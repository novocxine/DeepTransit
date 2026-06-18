import type { Classification } from "@/lib/api";
import { CLASSIFICATION_META } from "@/lib/api";
import { motion } from "framer-motion";

interface Props {
  classification: Classification;
  size?: "sm" | "md" | "lg";
  showEmoji?: boolean;
}

export default function ClassificationBadge({
  classification,
  size = "md",
  showEmoji = true,
}: Props) {
  const meta = CLASSIFICATION_META[classification];

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1 gap-1.5",
    md: "text-sm px-4 py-1.5 gap-2",
    lg: "text-base px-6 py-2 gap-2.5",
  };

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`inline-flex items-center font-semibold rounded-full classification-badge ${sizeClasses[size]}`}
      style={{
        color: meta.color,
        background: meta.bgColor,
        borderColor: meta.borderColor,
        boxShadow: `0 0 12px ${meta.color}25`,
      }}
    >
      {showEmoji && (
        <span className="text-base leading-none" role="img" aria-label={meta.label}>
          {meta.emoji}
        </span>
      )}
      {meta.label}
    </motion.span>
  );
}
