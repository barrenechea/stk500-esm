declare module 'stk500' { 
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
      sync(stream: NodeJS.ReadWriteStream, attempts: number, timeout: number): Promise<Buffer>;
      verifySignature(stream: NodeJS.ReadWriteStream, signature: Buffer, timeout: number): Promise<Buffer>;
      getSignature(stream: NodeJS.ReadWriteStream, timeout: number): Promise<Buffer>;
      setOptions(stream: NodeJS.ReadWriteStream, options: Record<string, number>, timeout: number): Promise<void>;
      enterProgrammingMode(stream: NodeJS.ReadWriteStream, timeout: number): Promise<Buffer>;
      loadAddress(stream: NodeJS.ReadWriteStream, useaddr: number, timeout: number): Promise<Buffer>;
      loadPage(stream: NodeJS.ReadWriteStream, writeBytes: Buffer, timeout: number): Promise<Buffer>;
      upload(stream: NodeJS.ReadWriteStream, hex: Buffer, pageSize: number, timeout: number, use_8_bit_addresses?: boolean): Promise<void>;
      exitProgrammingMode(stream: NodeJS.ReadWriteStream, timeout: number): Promise<Buffer>;
      verify(stream: NodeJS.ReadWriteStream, hex: Buffer, pageSize: number, timeout: number, use_8_bit_addresses?: boolean): Promise<void>;
      verifyPage(stream: NodeJS.ReadWriteStream, writeBytes: Buffer, pageSize: number, timeout: number): Promise<Buffer>;
      bootload(stream: NodeJS.ReadWriteStream, hex: Buffer, opt: Board, use_8_bit_addresses?: boolean): Promise<void>;
    }
  
    export = STK500;
  }