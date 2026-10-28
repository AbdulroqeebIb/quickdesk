import { useTranslation } from "react-i18next";

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`pill status-${status}`}>{t(`status.${status}`)}</span>
  );
}

export function PriorityTag({ priority }) {
  const { t } = useTranslation();
  return (
    <span className={`pill priority-${priority}`}>
      {t(`priority.${priority}`)}
    </span>
  );
}
