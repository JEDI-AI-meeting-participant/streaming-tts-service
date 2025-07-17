declare module 'morgan' {
  import { RequestHandler } from 'express';
  
  interface FormatFn {
    (tokens: any, req: any, res: any): string;
  }
  
  interface Options {
    immediate?: boolean;
    skip?: (req: any, res: any) => boolean;
    stream?: {
      write: (str: string) => void;
    };
  }
  
  function morgan(format: string, options?: Options): RequestHandler;
  function morgan(format: FormatFn, options?: Options): RequestHandler;
  
  export = morgan;
}