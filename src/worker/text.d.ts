/* Wrangler bundles .txt imports as strings. */
declare module '*.txt' {
  const text: string;
  export default text;
}
/* and .bin imports as bytes */
declare module '*.bin' {
  const data: ArrayBuffer;
  export default data;
}

/* The little of the Workers runtime the Worker uses beyond the web platform. */
interface Cache {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}
