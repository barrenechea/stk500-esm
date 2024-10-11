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
  signature: Uint8Array;
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

/**
 * A callback function for reporting bootloading progress.
 * @param status - The current status of the bootloading process.
 * @param percentage - The percentage of the bootloading process that is complete.
 * @returns void
 */
type BootloadProgressCallback = (status: string, percentage: number) => void;

class STK500 {
  private log: (...data: unknown[]) => void;
  private stream: NodeJS.ReadWriteStream;
  private board: Board;

  /**
   * Creates an instance of the STK500 programmer.
   * @param stream - The read/write stream for communication with the device.
   * @param board - The board configuration.
   * @param opts - Additional options for the STK500 instance.
   */
  constructor(
    stream: NodeJS.ReadWriteStream,
    board: Board,
    opts: STK500Options = {}
  ) {
    this.stream = stream;
    this.board = board;
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
   * @param attempts - The number of synchronization attempts.
   * @returns A promise that resolves with the synchronization response data.
   * @throws Error if synchronization fails after all attempts.
   */
  async sync(attempts: number): Promise<Uint8Array> {
    this.log("sync");
    let tries = 1;

    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseData: Constants.OK_RESPONSE,
      timeout: this.board.timeout,
    };

    while (tries <= attempts) {
      try {
        const data = await sendCommand(this.stream, opt);
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
   * @returns A promise that resolves with the verification response data.
   * @throws Error if the signature verification fails.
   */
  async verifySignature(): Promise<Uint8Array> {
    this.log("verify signature");
    const match = new Uint8Array([
      Constants.Resp_STK_INSYNC,
      ...this.board.signature,
      Constants.Resp_STK_OK,
    ]);

    const opt = {
      cmd: [Constants.Cmnd_STK_READ_SIGN],
      responseLength: match.length,
      timeout: this.board.timeout,
    };

    try {
      const data = await sendCommand(this.stream, opt);
      this.log(
        "confirm signature",
        data,
        Array.from(data)
          .map((b) => b.toString(16))
          .join("")
      );
      return data;
    } catch (err) {
      this.log("confirm signature", err, "no data");
      throw err;
    }
  }

  /**
   * Retrieves the device signature.
   * @returns A promise that resolves with the device signature data.
   */
  async getSignature(): Promise<Uint8Array> {
    this.log("get signature");
    const opt = {
      cmd: [Constants.Cmnd_STK_READ_SIGN],
      responseLength: 5,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log("getSignature", data);
    return data;
  }

  /**
   * Sets device-specific options.
   * @param options - An object containing device-specific options.
   * @returns A promise that resolves when the options are set.
   */
  async setOptions(options: Record<string, number>): Promise<void> {
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
      timeout: this.board.timeout,
    };

    const data = await sendCommand(this.stream, opt);
    this.log("setOptions", data);
  }

  /**
   * Enters programming mode on the device.
   * @returns A promise that resolves with the response data.
   */
  async enterProgrammingMode(): Promise<Uint8Array> {
    this.log("send enter programming mode");
    const opt = {
      cmd: [Constants.Cmnd_STK_ENTER_PROGMODE],
      responseData: Constants.OK_RESPONSE,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log("sent enter programming mode", data);
    return data;
  }

  /**
   * Loads a memory address for subsequent operations.
   * @param useaddr - The address to load.
   * @returns A promise that resolves with the response data.
   */
  async loadAddress(useaddr: number): Promise<Uint8Array> {
    this.log("load address");
    const addr_low = useaddr & 0xff;
    const addr_high = (useaddr >> 8) & 0xff;
    const opt = {
      cmd: [Constants.Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high],
      responseData: Constants.OK_RESPONSE,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log("loaded address", data);
    return data;
  }

  /**
   * Loads a page of data to be programmed.
   * @param writeBytes - The data to be programmed.
   * @returns A promise that resolves with the response data.
   */
  async loadPage(writeBytes: Uint8Array): Promise<Uint8Array> {
    this.log("load page");
    const bytes_low = writeBytes.length & 0xff;
    const bytes_high = writeBytes.length >> 8;

    const cmd = new Uint8Array([
      Constants.Cmnd_STK_PROG_PAGE,
      bytes_high,
      bytes_low,
      0x46,
      ...writeBytes,
      Constants.Sync_CRC_EOP,
    ]);

    const opt = {
      cmd: cmd,
      responseData: Constants.OK_RESPONSE,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log("loaded page", data);
    return data;
  }

  /**
   * Uploads the provided hex data to the device.
   * @param hexData - The hex data to be uploaded, as a string or Uint8Array.
   * @param progressCallback - Optional callback to report upload progress.
   * @returns A promise that resolves when the upload is complete.
   */
  async upload(
    hexData: string | Uint8Array,
    progressCallback?: (percentage: number) => void
  ): Promise<void> {
    this.log("program");

    const { data: hex } = parseIntelHex(hexData);

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("program page");

      try {
        useaddr = this.board.use8BitAddresses ? pageaddr : pageaddr >> 1;

        await this.loadAddress(useaddr);

        writeBytes = hex.subarray(
          pageaddr,
          hex.length > this.board.pageSize
            ? pageaddr + this.board.pageSize
            : hex.length
        );

        await this.loadPage(writeBytes);

        this.log("programmed page");
        pageaddr = pageaddr + writeBytes.length;

        await new Promise((resolve) => setTimeout(resolve, 4));

        this.log("page done");

        if (progressCallback) {
          progressCallback((pageaddr / hex.length) * 100);
        }
      } catch (error) {
        this.log("Error in page programming");
        throw error;
      }
    }

    this.log("upload done");
  }

  /**
   * Exits programming mode on the device.
   * @returns A promise that resolves with the response data.
   */
  async exitProgrammingMode(): Promise<Uint8Array> {
    this.log("send leave programming mode");
    const opt = {
      cmd: [Constants.Cmnd_STK_LEAVE_PROGMODE],
      responseData: Constants.OK_RESPONSE,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log("sent leave programming mode", data);
    return data;
  }

  /**
   * Verifies the uploaded data against the provided hex data.
   * @param hexData - The hex data to verify against, as a string or Uint8Array.
   * @param progressCallback - Optional callback to report verification progress.
   * @returns A promise that resolves when verification is complete.
   */
  async verify(
    hexData: string | Uint8Array,
    progressCallback?: (percentage: number) => void
  ): Promise<void> {
    this.log("verify");

    const { data: hex } = parseIntelHex(hexData);

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("verify page");

      try {
        useaddr = this.board.use8BitAddresses ? pageaddr : pageaddr >> 1;

        await this.loadAddress(useaddr);

        writeBytes = hex.subarray(
          pageaddr,
          hex.length > this.board.pageSize
            ? pageaddr + this.board.pageSize
            : hex.length
        );

        await this.verifyPage(writeBytes);

        this.log("verified page");
        pageaddr = pageaddr + writeBytes.length;

        await new Promise((resolve) => setTimeout(resolve, 4));

        this.log("verify done");

        if (progressCallback) {
          progressCallback((pageaddr / hex.length) * 100);
        }
      } catch (error) {
        this.log("Error in page verification");
        throw error;
      }
    }

    this.log("verify done");
  }

  /**
   * Verifies a single page of data.
   * @param writeBytes - The data to be verified.
   * @returns A promise that resolves with the verification response data.
   */
  async verifyPage(writeBytes: Uint8Array): Promise<Uint8Array> {
    this.log("verify page");
    const match = new Uint8Array([
      Constants.Resp_STK_INSYNC,
      ...writeBytes,
      Constants.Resp_STK_OK,
    ]);

    const size =
      writeBytes.length >= this.board.pageSize
        ? this.board.pageSize
        : writeBytes.length;

    const opt = {
      cmd: [
        Constants.Cmnd_STK_READ_PAGE,
        (size >> 8) & 0xff,
        size & 0xff,
        0x46,
      ],
      responseLength: match.length,
      timeout: this.board.timeout,
    };
    const data = await sendCommand(this.stream, opt);
    this.log(
      "confirm page",
      data,
      Array.from(data)
        .map((b) => b.toString(16))
        .join("")
    );
    return data;
  }

  /**
   * Performs the complete bootloading process for a device.
   * @param hexData - The hex data to be uploaded, as a string or Uint8Array.
   * @param progressCallback - Optional callback to report progress.
   * @returns A promise that resolves when the bootloading process is complete.
   */
  async bootload(
    hexData: string | Uint8Array,
    progressCallback?: BootloadProgressCallback
  ): Promise<void> {
    const parameters = {
      pagesizehigh: (this.board.pageSize << 8) & 0xff,
      pagesizelow: this.board.pageSize & 0xff,
    };

    const updateProgress = (status: string, percentage: number) => {
      if (progressCallback) {
        progressCallback(status, percentage);
      }
    };

    updateProgress("Syncing", 0);
    await this.sync(3);
    await this.sync(3);
    await this.sync(3);
    updateProgress("Verifying signature", 10);
    await this.verifySignature();
    updateProgress("Setting options", 20);
    await this.setOptions(parameters);
    updateProgress("Entering programming mode", 30);
    await this.enterProgrammingMode();
    updateProgress("Uploading", 40);
    await this.upload(hexData, (uploadPercentage) => {
      updateProgress("Uploading", 40 + uploadPercentage * 0.3);
    });
    updateProgress("Verifying", 70);
    await this.verify(hexData, (verifyPercentage) => {
      updateProgress("Verifying", 70 + verifyPercentage * 0.25);
    });
    updateProgress("Exiting programming mode", 95);
    await this.exitProgrammingMode();
    updateProgress("Complete", 100);
  }
}

export default STK500;
