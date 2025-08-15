/**
 * Public API of the reusable prototyping engine. A project imports everything it needs from
 * here via the `@engine` alias — it never reaches into individual engine modules. Keeping the
 * surface in one place is what lets the engine evolve independently of any single project.
 */

// App shell + flow driver
export { AppShell } from "./AppShell";
export type { AppShellProps, SetupProps, OverlayProps } from "./AppShell";
export { FlowEngine, fetchText } from "./FlowEngine";

// Runtime HTML component library — components authored as `.html` files under `public/`, fetched and
// compiled in the browser, so they can be added or changed by upload alone with no rebuild.
export { loadComponentLibrary } from "./html/loadComponentLibrary";
export type { LoadOptions as ComponentLibraryOptions } from "./html/loadComponentLibrary";
export type { ComponentDefinition, EffectSpec, Ctx as ComponentCtx } from "./html/createComponent";

// Moderator setup form, described by `public/setup.yaml` rather than by code — a test variable is
// added by editing YAML, and is then bindable in screens as `$bind: respondent.<name>`.
export { loadSetupSchema, defaultsFromSchema, schemaHasErrors } from "./setup/schema";
export type { SetupSchema, FieldSpec, FieldOption, ItemSpec, OverlaySpec } from "./setup/schema";
export { SchemaForm } from "./setup/SchemaForm";
export { ModeratorSetup } from "./setup/ModeratorSetup";
export { ModeratorOverlay } from "./setup/ModeratorOverlay";
export { loadRespondentConfig, respondentToYaml } from "./setup/respondentConfig";

// Form controls the setup form is built from; a project may reuse them in its own moderator UI.
export { AlertMessage } from "./setup/ui/AlertMessage";
export { TextInputField } from "./setup/ui/TextInputField";
export { SelectBoxField } from "./setup/ui/SelectBoxField";
export { CheckBoxField } from "./setup/ui/CheckBoxField";
export { RadioButtonField } from "./setup/ui/RadioButtonField";
export { DataRowValue } from "./setup/ui/DataRowValue";
export { Divider } from "./setup/ui/Divider";
export { TitleText } from "./setup/ui/TitleText";

// Engine context consumed by project components
export { useEngine } from "./EngineContext";
export type { EngineApi } from "./EngineContext";

// Condition matcher — lets project components filter arrays by a config `where`, so domain
// predicates live in YAML rather than in code.
export { matchesItem } from "./conditions";

// Component-registry contract the project fills in
export type { ComponentRegistry, RegistryEntry } from "./registry";

// Field validation framework
export { getValidationError } from "./validation";
export type { ValidatorConfig } from "./validation";

// Formatting helpers used by input components and by config-driven templates
export { onlyDigits, formatThousands, fillTemplate } from "./format";

// Session-state helpers (persisted flow data/position)
export {
  loadRespondent,
  saveRespondent,
  clearAll,
  clearDataAndPosition,
} from "./state";
export type { Data } from "./state";

// Screen/flow type definitions used across YAML-driven props
export type { ButtonAction, Condition, ComponentInstance, ScreenDefinition } from "./types/screen";
export type { FlowConfig, FlowNode } from "./types/flow";
