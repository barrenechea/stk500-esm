import Constants from "./lib/constants.js";
import sendCommand from "./lib/sendCommand.js";
import parseIntelHex from "./lib/intelHexParser.js";

/**
 * Represents the configuration for a specific board.
 */
export interface Board {
  /** The name of the board. */
  name: string;
  /** The baud rate for communication with the board. */
  baudRate: number;
  /** The expected signature of the board. */
  signature: Buffer;
  /** The page size for programming operations. */
  pageSize: number;
  /** The timeout duration for operations in milliseconds. */
  timeout: number;
  /** Whether to use 8-bit addresses for memory operations. */
  use8BitAddresses?: boolean;
}

/**
 * Options for configuring the STK500 instance.
 */
interface STK500Options {
  /** Whether to suppress logging output. */
  quiet?: boolean;
}

class STK500 {
  private log: (...data: unknown[]) => void;

  constructor(opts: STK500Options = {}) {
    this.log = opts.quiet
      ? () => {
          /* logging disabled */
        }
      : typeof window === "object"
      ? console.log.bind(window)
      : console.log;
  }

  /**
   * Attempts to synchronize communication with the device.
   * @param stream - The read/write stream for communication.
   * @param attempts - The number of synchronization attempts.
   * @param timeout - The timeout duration for each attempt in milliseconds.
   * @returns A promise that resolves with the synchronization response buffer.
   * @throws Error if synchronization fails after all attempts.
   */
  async sync(
    stream: NodeJS.ReadWriteStream,
    attempts: number,
    timeout: number
  ): Promise<Buffer> {
    this.log("sync");
    let tries = 1;

    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };

    while (tries <= attempts) {
      try {
        const data = await sendCommand(stream, opt);
        this.log("sync complete", data, tries);
        return data;
      } catch (err) {
        this.log(err);
        this.log("failed attempt again", tries);
        tries++;
      }
    }
    throw new Error("Sync failed after " + attempts + " attempts");
  }

  /**
   * Verifies the device signature.
   * @param stream - The read/write stream for communication.
   * @param signature - The expected device signature.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the verification response buffer.
   * @throws Error if the signature verification fails.
   */
  async verifySignature(
    stream: NodeJS.ReadWriteStream,
    signature: Buffer,
    timeout: number
  ): Promise<Buffer> {
    this.log("verify signature");
    const match = Buffer.concat([
      Buffer.from([Constants.Resp_STK_INSYNC]),
      signature,
      Buffer.from([Constants.Resp_STK_OK]),
    ]);

    const opt = {
      cmd: [Constants.Cmnd_STK_READ_SIGN],
      responseLength: match.length,
      timeout: timeout,
    };

    try {
      const data = await sendCommand(stream, opt);
      this.log("confirm signature", data, data.toString("hex"));
      return data;
    } catch (err) {
      this.log("confirm signature", err, "no data");
      throw err;
    }
  }

  /**
   * Retrieves the device signature.
   * @param stream - The read/write stream for communication.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the device signature buffer.
   */
  async getSignature(
    stream: NodeJS.ReadWriteStream,
    timeout: number
  ): Promise<Buffer> {
    this.log("get signature");
    const opt = {
      cmd: [Constants.Cmnd_STK_READ_SIGN],
      responseLength: 5,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("getSignature", data);
    return data;
  }

  /**
   * Sets device-specific options.
   * @param stream - The read/write stream for communication.
   * @param options - An object containing device-specific options.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves when the options are set.
   */
  async setOptions(
    stream: NodeJS.ReadWriteStream,
    options: Record<string, number>,
    timeout: number
  ): Promise<void> {
    this.log("set device");

    const opt = {
      cmd: [
        Constants.Cmnd_STK_SET_DEVICE,
        options.devicecode || 0,
        options.revision || 0,
        options.progtype || 0,
        options.parmode || 0,
        options.polling || 0,
        options.selftimed || 0,
        options.lockbytes || 0,
        options.fusebytes || 0,
        options.flashpollval1 || 0,
        options.flashpollval2 || 0,
        options.eeprompollval1 || 0,
        options.eeprompollval2 || 0,
        options.pagesizehigh || 0,
        options.pagesizelow || 0,
        options.eepromsizehigh || 0,
        options.eepromsizelow || 0,
        options.flashsize4 || 0,
        options.flashsize3 || 0,
        options.flashsize2 || 0,
        options.flashsize1 || 0,
      ],
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };

    const data = await sendCommand(stream, opt);
    this.log("setOptions", data);
  }

  /**
   * Enters programming mode on the device.
   * @param stream - The read/write stream for communication.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the response buffer.
   */
  async enterProgrammingMode(
    stream: NodeJS.ReadWriteStream,
    timeout: number
  ): Promise<Buffer> {
    this.log("send enter programming mode");
    const opt = {
      cmd: [Constants.Cmnd_STK_ENTER_PROGMODE],
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("sent enter programming mode", data);
    return data;
  }

  /**
   * Loads a memory address for subsequent operations.
   * @param stream - The read/write stream for communication.
   * @param useaddr - The address to load.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the response buffer.
   */
  async loadAddress(
    stream: NodeJS.ReadWriteStream,
    useaddr: number,
    timeout: number
  ): Promise<Buffer> {
    this.log("load address");
    const addr_low = useaddr & 0xff;
    const addr_high = (useaddr >> 8) & 0xff;
    const opt = {
      cmd: [Constants.Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high],
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("loaded address", data);
    return data;
  }

  /**
   * Loads a page of data to be programmed.
   * @param stream - The read/write stream for communication.
   * @param writeBytes - The buffer containing the data to be programmed.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the response buffer.
   */
  async loadPage(
    stream: NodeJS.ReadWriteStream,
    writeBytes: Buffer,
    timeout: number
  ): Promise<Buffer> {
    this.log("load page");
    const bytes_low = writeBytes.length & 0xff;
    const bytes_high = writeBytes.length >> 8;

    const cmd = Buffer.concat([
      Buffer.from([Constants.Cmnd_STK_PROG_PAGE, bytes_high, bytes_low, 0x46]),
      writeBytes,
      Buffer.from([Constants.Sync_CRC_EOP]),
    ]);

    const opt = {
      cmd: cmd,
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("loaded page", data);
    return data;
  }

  /**
   * Uploads the provided hex data to the device.
   * @param stream - The read/write stream for communication.
   * @param hexData - The hex data to be uploaded, as a string or buffer.
   * @param pageSize - The page size for programming.
   * @param timeout - The timeout duration in milliseconds.
   * @param use8BitAddresses - Whether to use 8-bit addresses (default: false).
   * @returns A promise that resolves when the upload is complete.
   */
  async upload(
    stream: NodeJS.ReadWriteStream,
    hexData: string | Buffer,
    pageSize: number,
    timeout: number,
    use8BitAddresses = false
  ): Promise<void> {
    this.log("program");

    // Parse the Intel HEX data
    const { data: hex } = parseIntelHex(hexData);

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("program page");

      try {
        useaddr = use8BitAddresses ? pageaddr : pageaddr >> 1;

        await this.loadAddress(stream, useaddr, timeout);

        writeBytes = hex.slice(
          pageaddr,
          hex.length > pageSize ? pageaddr + pageSize : hex.length
        );

        await this.loadPage(stream, writeBytes, timeout);

        this.log("programmed page");
        pageaddr = pageaddr + writeBytes.length;

        await new Promise((resolve) => setTimeout(resolve, 4));

        this.log("page done");
      } catch (error) {
        this.log("Error in page programming");
        throw error;
      }
    }

    this.log("upload done");
  }

  /**
   * Exits programming mode on the device.
   * @param stream - The read/write stream for communication.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the response buffer.
   */
  async exitProgrammingMode(
    stream: NodeJS.ReadWriteStream,
    timeout: number
  ): Promise<Buffer> {
    this.log("send leave programming mode");
    const opt = {
      cmd: [Constants.Cmnd_STK_LEAVE_PROGMODE],
      responseData: Constants.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("sent leave programming mode", data);
    return data;
  }

  /**
   * Verifies the uploaded data against the provided hex data.
   * @param stream - The read/write stream for communication.
   * @param hexData - The hex data to verify against, as a string or buffer.
   * @param pageSize - The page size for verification.
   * @param timeout - The timeout duration in milliseconds.
   * @param use8BitAddresses - Whether to use 8-bit addresses (default: false).
   * @returns A promise that resolves when verification is complete.
   */
  async verify(
    stream: NodeJS.ReadWriteStream,
    hexData: string | Buffer,
    pageSize: number,
    timeout: number,
    use8BitAddresses = false
  ): Promise<void> {
    this.log("verify");

    // Parse the Intel HEX data
    const { data: hex } = parseIntelHex(hexData);

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("verify page");

      try {
        useaddr = use8BitAddresses ? pageaddr : pageaddr >> 1;

        await this.loadAddress(stream, useaddr, timeout);

        writeBytes = hex.slice(
          pageaddr,
          hex.length > pageSize ? pageaddr + pageSize : hex.length
        );

        await this.verifyPage(stream, writeBytes, pageSize, timeout);

        this.log("verified page");
        pageaddr = pageaddr + writeBytes.length;

        await new Promise((resolve) => setTimeout(resolve, 4));

        this.log("verify done");
      } catch (error) {
        this.log("Error in page verification");
        throw error;
      }
    }

    this.log("verify done");
  }

  /**
   * Verifies a single page of data.
   * @param stream - The read/write stream for communication.
   * @param writeBytes - The buffer containing the data to be verified.
   * @param pageSize - The page size for verification.
   * @param timeout - The timeout duration in milliseconds.
   * @returns A promise that resolves with the verification response buffer.
   */
  async verifyPage(
    stream: NodeJS.ReadWriteStream,
    writeBytes: Buffer,
    pageSize: number,
    timeout: number
  ): Promise<Buffer> {
    this.log("verify page");
    const match = Buffer.concat([
      Buffer.from([Constants.Resp_STK_INSYNC]),
      writeBytes,
      Buffer.from([Constants.Resp_STK_OK]),
    ]);

    const size = writeBytes.length >= pageSize ? pageSize : writeBytes.length;

    const opt = {
      cmd: [
        Constants.Cmnd_STK_READ_PAGE,
        (size >> 8) & 0xff,
        size & 0xff,
        0x46,
      ],
      responseLength: match.length,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("confirm page", data, data.toString("hex"));
    return data;
  }

  /**
   * Performs the complete bootloading process for a device.
   * @param stream - The read/write stream for communication.
   * @param hexData - The hex data to be uploaded, as a string or buffer.
   * @param opt - The board configuration options.
   * @returns A promise that resolves when the bootloading process is complete.
   */
  async bootload(
    stream: NodeJS.ReadWriteStream,
    hexData: string | Buffer,
    opt: Board
  ): Promise<void> {
    // TODO: Are these calcs based on opt.pageSize okay? Not really sure
    const parameters = {
      pagesizehigh: (opt.pageSize << 8) & 0xff,
      pagesizelow: opt.pageSize & 0xff,
    };

    await this.sync(stream, 3, opt.timeout);
    await this.sync(stream, 3, opt.timeout);
    await this.sync(stream, 3, opt.timeout);
    await this.verifySignature(stream, opt.signature, opt.timeout);
    await this.setOptions(stream, parameters, opt.timeout);
    await this.enterProgrammingMode(stream, opt.timeout);
    await this.upload(
      stream,
      hexData,
      opt.pageSize,
      opt.timeout,
      opt.use8BitAddresses ?? false
    );
    await this.verify(
      stream,
      hexData,
      opt.pageSize,
      opt.timeout,
      opt.use8BitAddresses ?? false
    );
    await this.exitProgrammingMode(stream, opt.timeout);
  }
}

export default STK500;
