declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// styled-jsx support
declare module 'react' {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
