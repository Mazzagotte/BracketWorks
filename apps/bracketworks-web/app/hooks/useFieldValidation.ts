'use client';

import { useCallback, useMemo, useState } from 'react';

type FieldMap = Record<string, string>;

type ValidateFieldFn<Fields extends FieldMap> = (
  fieldName: keyof Fields,
  value: string,
  values: Fields
) => string;

function buildStringMap<Fields extends FieldMap>(values: Fields, initialValue: string): Record<keyof Fields, string> {
  return Object.keys(values).reduce((accumulator, key) => {
    accumulator[key as keyof Fields] = initialValue;
    return accumulator;
  }, {} as Record<keyof Fields, string>);
}

function buildBooleanMap<Fields extends FieldMap>(values: Fields, initialValue: boolean): Record<keyof Fields, boolean> {
  return Object.keys(values).reduce((accumulator, key) => {
    accumulator[key as keyof Fields] = initialValue;
    return accumulator;
  }, {} as Record<keyof Fields, boolean>);
}

export function useFieldValidation<Fields extends FieldMap>(
  initialValues: Fields,
  validateField: ValidateFieldFn<Fields>
) {
  const emptyErrors = useMemo(() => buildStringMap(initialValues, ''), [initialValues]);
  const untouchedFields = useMemo(() => buildBooleanMap(initialValues, false), [initialValues]);
  const touchedFields = useMemo(() => buildBooleanMap(initialValues, true), [initialValues]);

  const [fieldErrors, setFieldErrors] = useState<Record<keyof Fields, string>>(emptyErrors);
  const [fieldTouched, setFieldTouched] = useState<Record<keyof Fields, boolean>>(untouchedFields);

  const validateSingle = useCallback(
    (fieldName: keyof Fields, value: string, values: Fields): string => validateField(fieldName, value, values),
    [validateField]
  );

  const validateAll = useCallback(
    (values: Fields) => {
      const nextErrors = Object.keys(values).reduce((accumulator, key) => {
        const typedKey = key as keyof Fields;
        accumulator[typedKey] = validateField(typedKey, values[typedKey] ?? '', values);
        return accumulator;
      }, {} as Record<keyof Fields, string>);

      setFieldErrors(nextErrors);
      setFieldTouched(touchedFields);

      return nextErrors;
    },
    [touchedFields, validateField]
  );

  const handleFieldChange = useCallback(
    (fieldName: keyof Fields, value: string, values: Fields) => {
      if (fieldErrors[fieldName] && value.trim()) {
        setFieldErrors(previous => ({ ...previous, [fieldName]: '' }));
      }

      if (fieldTouched[fieldName] || value.length > 0) {
        const nextError = validateField(fieldName, value, values);
        setFieldErrors(previous => ({ ...previous, [fieldName]: nextError }));
      }
    },
    [fieldErrors, fieldTouched, validateField]
  );

  const handleFieldBlur = useCallback(
    (fieldName: keyof Fields, value: string, values: Fields) => {
      setFieldTouched(previous => ({ ...previous, [fieldName]: true }));
      const nextError = validateField(fieldName, value, values);
      setFieldErrors(previous => ({ ...previous, [fieldName]: nextError }));
    },
    [validateField]
  );

  const setFieldError = useCallback((fieldName: keyof Fields, error: string) => {
    setFieldErrors(previous => ({ ...previous, [fieldName]: error }));
  }, []);

  const setTouched = useCallback((fieldName: keyof Fields, touched = true) => {
    setFieldTouched(previous => ({ ...previous, [fieldName]: touched }));
  }, []);

  const resetValidation = useCallback(() => {
    setFieldErrors(emptyErrors);
    setFieldTouched(untouchedFields);
  }, [emptyErrors, untouchedFields]);

  return {
    fieldErrors,
    fieldTouched,
    handleFieldBlur,
    handleFieldChange,
    resetValidation,
    setFieldError,
    setFieldErrors,
    setFieldTouched,
    setTouched,
    untouchedFields,
    validateAll,
    validateSingle,
  };
}