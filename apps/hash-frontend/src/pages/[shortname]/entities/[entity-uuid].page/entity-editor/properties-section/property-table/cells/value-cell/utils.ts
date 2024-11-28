import type { ClosedDataType } from "@blockprotocol/type-system/slim";
import isPlainObject from "lodash/isPlainObject";

import type { EditorType } from "./types";

const isEmptyArray = (value: unknown) => Array.isArray(value) && !value.length;

const isValidTypeForSchemas = (
  type: "string" | "boolean" | "number" | "object" | "null",
  expectedTypes: ClosedDataType[],
) =>
  expectedTypes.some(({ allOf }) =>
    allOf.some((constraint) =>
      "type" in constraint
        ? constraint.type === type
        : constraint.anyOf.some((subType) => subType.type === type),
    ),
  );

/**
 * @todo H-3374 we don't need to guess the type anymore, because the exact dataTypeId will be in the entity's metadata
 */
export const guessEditorTypeFromValue = (
  value: unknown,
  expectedTypes: ClosedDataType[],
): EditorType => {
  if (
    typeof value === "string" &&
    isValidTypeForSchemas("string", expectedTypes)
  ) {
    return "string";
  }

  if (
    typeof value === "boolean" &&
    isValidTypeForSchemas("boolean", expectedTypes)
  ) {
    return "boolean";
  }

  if (
    typeof value === "number" &&
    isValidTypeForSchemas("number", expectedTypes)
  ) {
    return "number";
  }

  if (isPlainObject(value) && isValidTypeForSchemas("object", expectedTypes)) {
    return "object";
  }

  if (value === null && isValidTypeForSchemas("null", expectedTypes)) {
    return "null";
  }

  if (
    isEmptyArray(value) &&
    expectedTypes.some((dataType) => dataType.title === "Empty List")
  ) {
    return "emptyList";
  }

  return "unknown";
};

export const guessEditorTypeFromExpectedType = (
  dataType: ClosedDataType,
): EditorType => {
  if (dataType.title === "Empty List") {
    return "emptyList";
  }

  let type: "string" | "number" | "boolean" | "object" | "null" | "array";

  const firstConstraint = dataType.allOf[0];

  if ("anyOf" in firstConstraint) {
    /**
     * @todo H-3374 support multiple expected data types
     */
    type = firstConstraint.anyOf[0].type;
  } else {
    type = firstConstraint.type;
  }

  if (type === "array") {
    /**
     * @todo H-3374 support array and tuple data types
     */
    throw new Error("Array data types are not yet handled.");
  }

  return type;
};

export const isBlankStringOrNullish = (value: unknown) => {
  const isBlankString = typeof value === "string" && !value.trim().length;
  return isBlankString || value === null || value === undefined;
};
