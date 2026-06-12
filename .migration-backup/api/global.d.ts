declare module '@vercel/node' {
  // minimal ambient declaration to satisfy TypeScript in Vercel build
  const whatever: any;
  export = whatever;
}

declare var fetch: typeof globalThis.fetch;
declare var process: NodeJS.Process;
declare var console: Console;

export {};
