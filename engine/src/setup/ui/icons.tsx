import type { ReactNode } from "react";

const base = import.meta.env.BASE_URL;

/** Start-icon asset library for ListItemAction (`swapStartIcon`). Add new icons here as they're needed. */
export const startIcons: Record<string, ReactNode> = {
  pdf: <img src={`${base}resources/icon-pdf.svg`} alt="" width={18} height={21} />,
};

export const caretDownIcon: ReactNode = <img src={`${base}resources/icon-caret-down.svg`} alt="" width={16} height={9} />;

export const chevronRightIcon: ReactNode = (
  <img src={`${base}resources/icon-chevron-right.svg`} alt="" width={9} height={16} />
);
