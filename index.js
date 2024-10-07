import Statics from "./lib/statics.js";
import sendCommand from "./lib/sendCommand.js";

class STK500 {
  /** Create a new STK500 instance
   * @param {Object} opts - Options
   * @param {boolean} opts.quiet - If true, suppress log output
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.quiet = this.opts.quiet || false;
    this.log = this.quiet
      ? () => {}
      : typeof window === "object"
      ? console.log.bind(window)
      : console.log;
  }

  async sync(stream, attempts, timeout) {
    this.log("sync");
    let tries = 1;

    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
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

  async verifySignature(stream, signature, timeout) {
    this.log("verify signature");
    const match = Buffer.concat([
      Buffer.from([Statics.Resp_STK_INSYNC]),
      signature,
      Buffer.from([Statics.Resp_STK_OK]),
    ]);

    const opt = {
      cmd: [Statics.Cmnd_STK_READ_SIGN],
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

  async getSignature(stream, timeout) {
    this.log("get signature");
    const opt = {
      cmd: [Statics.Cmnd_STK_READ_SIGN],
      responseLength: 5,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("getSignature", data);
    return data;
  }

  async setOptions(stream, options, timeout) {
    this.log("set device");

    const opt = {
      cmd: [
        Statics.Cmnd_STK_SET_DEVICE,
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
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };

    const data = await sendCommand(stream, opt);
    this.log("setOptions", data);
  }

  async enterProgrammingMode(stream, timeout) {
    this.log("send enter programming mode");
    const opt = {
      cmd: [Statics.Cmnd_STK_ENTER_PROGMODE],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("sent enter programming mode", data);
    return data;
  }

  async loadAddress(stream, useaddr, timeout) {
    this.log("load address");
    const addr_low = useaddr & 0xff;
    const addr_high = (useaddr >> 8) & 0xff;
    const opt = {
      cmd: [Statics.Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("loaded address", data);
    return data;
  }

  async loadPage(stream, writeBytes, timeout) {
    this.log("load page");
    const bytes_low = writeBytes.length & 0xff;
    const bytes_high = writeBytes.length >> 8;

    const cmd = Buffer.concat([
      Buffer.from([Statics.Cmnd_STK_PROG_PAGE, bytes_high, bytes_low, 0x46]),
      writeBytes,
      Buffer.from([Statics.Sync_CRC_EOP]),
    ]);

    const opt = {
      cmd: cmd,
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("loaded page", data);
    return data;
  }

  async upload(stream, hex, pageSize, timeout, use_8_bit_addresses) {
    this.log("program");

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("program page");

      try {
        useaddr = use_8_bit_addresses ? pageaddr : pageaddr >> 1;

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

  async exitProgrammingMode(stream, timeout) {
    this.log("send leave programming mode");
    const opt = {
      cmd: [Statics.Cmnd_STK_LEAVE_PROGMODE],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("sent leave programming mode", data);
    return data;
  }

  async verify(stream, hex, pageSize, timeout, use_8_bit_addresses) {
    this.log("verify");

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    while (pageaddr < hex.length) {
      this.log("verify page");

      try {
        useaddr = use_8_bit_addresses ? pageaddr : pageaddr >> 1;

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

  async verifyPage(stream, writeBytes, pageSize, timeout) {
    this.log("verify page");
    const match = Buffer.concat([
      Buffer.from([Statics.Resp_STK_INSYNC]),
      writeBytes,
      Buffer.from([Statics.Resp_STK_OK]),
    ]);

    const size = writeBytes.length >= pageSize ? pageSize : writeBytes.length;

    const opt = {
      cmd: [Statics.Cmnd_STK_READ_PAGE, (size >> 8) & 0xff, size & 0xff, 0x46],
      responseLength: match.length,
      timeout: timeout,
    };
    const data = await sendCommand(stream, opt);
    this.log("confirm page", data, data.toString("hex"));
    return data;
  }

  async bootload(stream, hex, opt, use_8_bit_addresses) {
    const parameters = {
      pagesizehigh: (opt.pagesizehigh << 8) & 0xff,
      pagesizelow: opt.pagesizelow & 0xff,
    };

    try {
      await this.sync(stream, 3, opt.timeout);
      await this.sync(stream, 3, opt.timeout);
      await this.sync(stream, 3, opt.timeout);
      await this.verifySignature(stream, opt.signature, opt.timeout);
      await this.setOptions(stream, parameters, opt.timeout);
      await this.enterProgrammingMode(stream, opt.timeout);
      await this.upload(
        stream,
        hex,
        opt.pageSize,
        opt.timeout,
        use_8_bit_addresses
      );
      await this.verify(
        stream,
        hex,
        opt.pageSize,
        opt.timeout,
        use_8_bit_addresses
      );
      await this.exitProgrammingMode(stream, opt.timeout);
    } catch (error) {
      throw error;
    }
  }
}

export default STK500;
