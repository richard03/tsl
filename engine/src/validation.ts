export interface ValidatorConfig {
  /** Key into VALIDATOR_DEFINITIONS, e.g. "mandatory", "email", "positiveNumber". */
  type: string;
  /** Overrides the validator's default message when it fails. */
  message?: string;
}

interface ValidatorDefinition {
  defaultMessage: string;
  isValid: (value: string) => boolean;
}

/**
 * Registry of validator types configurable from screen YAML (`validators: [{ type: ... }]`).
 * Add new entries here to make a new validator type available to form components.
 */
const VALIDATOR_DEFINITIONS: Record<string, ValidatorDefinition> = {
  mandatory: {
    defaultMessage: "Toto pole je povinné.",
    isValid: (value) => value.trim() !== "",
  },
  email: {
    defaultMessage: "Zadejte platnou e-mailovou adresu.",
    // Empty is left to the "mandatory" validator so the two can be combined independently.
    isValid: (value) => value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()),
  },
  positiveNumber: {
    defaultMessage: "Zadejte kladné číslo.",
    isValid: (value) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) > 0),
  },
  positiveAmount: {
    defaultMessage: "Částka musí být kladné číslo nebo 0.",
    isValid: (value) => value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) >= 0),
  },
};

/**
 * Runs `validators` against `value` in order and returns the message of the first one that
 * fails, or undefined if the value satisfies all of them (or none are configured).
 */
export function getValidationError(value: string, validators?: ValidatorConfig[]): string | undefined {
  if (!validators) return undefined;
  for (const config of validators) {
    const definition = VALIDATOR_DEFINITIONS[config.type];
    if (!definition) {
      console.warn(`Neznámý typ validátoru: "${config.type}"`);
      continue;
    }
    if (!definition.isValid(value)) {
      return config.message ?? definition.defaultMessage;
    }
  }
  return undefined;
}
