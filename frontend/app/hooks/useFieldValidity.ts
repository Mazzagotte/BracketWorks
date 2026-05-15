'use client';

import { useCallback, useMemo, useState } from 'react';

type FieldMap = Record<string, string>;

type ValidateFieldFn<Fields extends FieldMap> = (
  fieldName: keyof Fields,
  value: string,
  values: Fields
) => boolean;

function buildBooleanMap<Fields extends FieldMap>(values: Fields, initialValue: boolean): Record<keyof Fields, boolean> {
  return Object.keys(values).reduce((accumulator, key) => {
    accumulator[key as keyof Fields] = initialValue;
    return accumulator;
  }, {} as Record<keyof Fields, boolean>);
}

export function useFieldValidity<Fields extends FieldMap>(
  initialValues: Fields,
  validateField: ValidateFieldFn<Fields>
) {
  const defaultValidity = useMemo(() => buildBooleanMap(initialValues, false), [initialValues]);
  const [fieldValidity, setFieldValidity] = useState<Record<keyof Fields, boolean>>(defaultValidity);

  const validateSingle = useCallback(
    (fieldName: keyof Fields, value: string, values: Fields) => validateField(fieldName, value, values),
    [validateField]
  );

  const updateFieldValidity = useCallback(
    (fieldName: keyof Fields, value: string, values: Fields) => {
      const isValid = validateField(fieldName, value, values);
      setFieldValidity(previous => ({ ...previous, [fieldName]: isValid }));
      return isValid;
    },
    [validateField]
  );

  const validateAll = useCallback(
    (values: Fields) => {
      const nextValidity = Object.keys(values).reduce((accumulator, key) => {
        const typedKey = key as keyof Fields;
        accumulator[typedKey] = validateField(typedKey, values[typedKey], values);
        return accumulator;
      }, {} as Record<keyof Fields, boolean>);

      setFieldValidity(nextValidity);
      return nextValidity;
    },
    [validateField]
  );

  const resetFieldValidity = useCallback(() => {
    setFieldValidity(defaultValidity);
  }, [defaultValidity]);

  return {
    fieldValidity,
    resetFieldValidity,
    setFieldValidity,
    updateFieldValidity,
    validateAll,
    validateSingle,
  };
}