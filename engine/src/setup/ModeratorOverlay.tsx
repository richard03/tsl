/**
 * Default floating moderator controls shown during a run.
 *
 * What it says about the respondent comes from `overlay:` in `setup.yaml`, so the engine never has
 * to assume a respondent has a name, a scenario or a list of products.
 */
import { useEffect, useState } from "react";
import { fetchText } from "../FlowEngine";
import type { OverlaySpec } from "./schema";
import { getSetupSchema } from "./schema";

export interface ModeratorOverlayProps {
  respondent: unknown;
  onEndAndClear: () => void;
  onRestartFlow: () => void;
}

/** One summary line: either the length of an array field, or the value itself (optionally mapped). */
function lineText(spec: NonNullable<OverlaySpec["lines"]>[number], respondent: Record<string, unknown>): string {
  const raw = respondent[spec.field];
  const body = spec.count ? String(Array.isArray(raw) ? raw.length : 0) : (spec.map?.[String(raw)] ?? String(raw ?? ""));
  return spec.suffix ? `${body} ${spec.suffix}` : body;
}

export function ModeratorOverlay({ respondent, onEndAndClear, onRestartFlow }: ModeratorOverlayProps) {
  const [overlay, setOverlay] = useState<OverlaySpec | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // No setup.yaml (or a broken one) just means the panel shows its buttons without a summary —
    // better than hiding the moderator's controls entirely.
    getSetupSchema(import.meta.env.BASE_URL, fetchText)
      .then((schema) => !cancelled && setOverlay(schema?.overlay ?? {}))
      .catch(() => !cancelled && setOverlay({}));
    return () => {
      cancelled = true;
    };
  }, []);

  const data = (respondent ?? {}) as Record<string, unknown>;
  const title = overlay?.title ? String(data[overlay.title.field] ?? "") : "";

  return (
    <>
      <button
        type="button"
        className="moderator-toggle"
        aria-label={overlay?.toggleLabel ?? "Moderátorské ovládání"}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>

      {open && (
        <div className="moderator-panel">
          {(title || overlay?.lines?.length) && (
            <div className="moderator-panel__respondent">
              {title && <strong>{title}</strong>}
              {overlay?.lines?.map((line) => (
                <span key={line.field}>{lineText(line, data)}</span>
              ))}
            </div>
          )}
          <button type="button" className="button button--secondary" onClick={onRestartFlow}>
            {overlay?.restartText ?? "Restartovat flow (stejný respondent)"}
          </button>
          <button type="button" className="button button--danger" onClick={onEndAndClear}>
            {overlay?.endText ?? "Ukončit test a smazat data"}
          </button>
        </div>
      )}
    </>
  );
}
