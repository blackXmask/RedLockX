declare module '@vercel/node' {
  import type http from 'http';
  export type VercelRequest = http.IncomingMessage & { json?: any; query?: Record<string,string> };
  export type VercelResponse = http.ServerResponse & { json?: (body: any) => void };
  const handler: (req: VercelRequest, res: VercelResponse) => any;
  export default handler;
}
