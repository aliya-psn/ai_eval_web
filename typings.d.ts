/// <reference types="react" />
/// <reference types="react-dom" />

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default React.FC<React.SVGProps<SVGSVGElement>>;
}

declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.json' {
  const content: any;
  export default content;
}
