declare module '@vercel/node' {
  const whatever: any;
  export = whatever;
}

declare global {
  var fetch: typeof globalThis.fetch;
  var process: NodeJS.Process;
  var console: Console;
}

export {};
