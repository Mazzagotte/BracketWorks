'use client';

type AuthFeedbackProps = {
  error?: string;
  success?: string;
  errorClassName?: string;
  successClassName?: string;
  role?: 'alert' | 'status';
  wrapErrorInSpan?: boolean;
};

export default function AuthFeedback({
  error,
  success,
  errorClassName = 'surface-feedback surface-feedbackError',
  successClassName = 'surface-feedback surface-feedbackSuccess',
  role = 'alert',
  wrapErrorInSpan = false,
}: AuthFeedbackProps) {
  return (
    <>
      {success ? <div className={successClassName} role={role}>{success}</div> : null}
      {error ? (
        <div className={errorClassName} role={role}>
          {wrapErrorInSpan ? <span>{error}</span> : error}
        </div>
      ) : null}
    </>
  );
}