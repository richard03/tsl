import type { ReactNode } from "react";

type AlertIntent = "info" | "success" | "warning" | "error";

interface AlertMessageProps {
  intent?: AlertIntent;
  text: string;
}

const base = import.meta.env.BASE_URL;

const icons: Record<AlertIntent, ReactNode> = {
  info: <img src={`${base}resources/alert-info.svg`} alt="" width={14} height={14} />,
  success: <img src={`${base}resources/alert-success.svg`} alt="" width={14} height={14} />,
  warning: <img src={`${base}resources/alert-warning.svg`} alt="" width={14} height={13} />,
  error: <img src={`${base}resources/alert-error.svg`} alt="" width={14} height={14} />,
};

export function AlertMessage({ intent = "info", text }: AlertMessageProps) {
  return (
    <div className={`alert-message alert-message--${intent}`}>
      <span className="alert-message__icon" aria-hidden="true">
        {icons[intent]}
      </span>
      <p className="alert-message__text">{text}</p>
    </div>
  );
}
