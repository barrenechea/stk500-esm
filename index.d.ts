declare module 'stk500' {
    import { ReadWriteStream } from 'stream';
  
    interface Board {
      name: string;
      baud: number;
      signature: Buffer;
      pageSize: number;
      timeout: number;
    }
  
    interface STK500Options {
      quiet?: boolean;
    }
  
    class STK500 {
      constructor(opts?: STK500Options);
  
      log(what: string): void;
      sync(stream: ReadWriteStream, attempts: number, timeout: number): Promise<Buffer>;
      verifySignature(stream: ReadWriteStream, signature: Buffer, timeout: number): Promise<Buffer>;
      getSignature(stream: ReadWriteStream, timeout: number): Promise<Buffer>;
      setOptions(stream: ReadWriteStream, options: Record<string, number>, timeout: number): Promise<void>;
      enterProgrammingMode(stream: ReadWriteStream, timeout: number): Promise<Buffer>;
      loadAddress(stream: ReadWriteStream, useaddr: number, timeout: number): Promise<Buffer>;
      loadPage(stream: ReadWriteStream, writeBytes: Buffer, timeout: number): Promise<Buffer>;
      upload(stream: ReadWriteStream, hex: Buffer, pageSize: number, timeout: number, use_8_bit_addresses?: boolean): Promise<void>;
      exitProgrammingMode(stream: ReadWriteStream, timeout: number): Promise<Buffer>;
      verify(stream: ReadWriteStream, hex: Buffer, pageSize: number, timeout: number, use_8_bit_addresses?: boolean): Promise<void>;
      verifyPage(stream: ReadWriteStream, writeBytes: Buffer, pageSize: number, timeout: number): Promise<Buffer>;
      bootload(stream: ReadWriteStream, hex: Buffer, opt: Board, use_8_bit_addresses?: boolean): Promise<void>;
    }
  
    export = STK500;
  }