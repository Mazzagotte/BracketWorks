  declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// styled-jsx support
import type * as React from 'react';

declare module 'react' {
  // Augment React's existing StyleHTMLAttributes so we don't replace the
  // entire module. This ensures standard exports like `useEffect` are
  // preserved while adding the `jsx` / `global` flags used by styled-jsx.
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
