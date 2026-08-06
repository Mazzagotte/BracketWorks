declare module 'react-usa-map' {
  import type { FC } from 'react';

  export type USAStateCustomize = {
    fill?: string;
    clickHandler?: () => void;
  };

  export type USAStateCustomizeMap = Record<string, USAStateCustomize>;

  export type USAMapProps = {
    customize?: USAStateCustomizeMap;
    defaultFill?: string;
    title?: string;
  };

  const USAMap: FC<USAMapProps>;
  export default USAMap;
}
