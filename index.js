import async from "async";
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
    if (this.quiet) {
      this.log = () => {};
    } else {
      if (typeof window === "object") {
        this.log = console.log.bind(window);
      } else {
        this.log = console.log;
      }
    }
  }

  sync(stream, attempts, timeout, done) {
    this.log("sync");
    let tries = 1;

    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };

    const attempt = () => {
      tries++;
      sendCommand(stream, opt, (err, data) => {
        if (err && tries <= attempts) {
          if (err) {
            this.log(err);
          }
          this.log("failed attempt again", tries);
          return attempt();
        }
        this.log("sync complete", err, data, tries);
        done(err, data);
      });
    };

    attempt();
  }

  verifySignature(stream, signature, timeout, done) {
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

    sendCommand(stream, opt, (err, data) => {
      if (data) {
        this.log("confirm signature", err, data, data.toString("hex"));
      } else {
        this.log("confirm signature", err, "no data");
      }
      done(err, data);
    });
  }

  getSignature(stream, timeout, done) {
    this.log("get signature");
    const opt = {
      cmd: [Statics.Cmnd_STK_READ_SIGN],
      responseLength: 5,
      timeout: timeout,
    };
    sendCommand(stream, opt, (err, data) => {
      this.log("getSignature", err, data);
      done(err, data);
    });
  }

  setOptions(stream, options, timeout, done) {
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

    sendCommand(stream, opt, (err, data) => {
      this.log("setOptions", err, data);
      if (err) {
        return done(err);
      }
      done();
    });
  }

  enterProgrammingMode(stream, timeout, done) {
    this.log("send enter programming mode");
    const opt = {
      cmd: [Statics.Cmnd_STK_ENTER_PROGMODE],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    sendCommand(stream, opt, (err, data) => {
      this.log("sent enter programming mode", err, data);
      done(err, data);
    });
  }

  loadAddress(stream, useaddr, timeout, done) {
    this.log("load address");
    const addr_low = useaddr & 0xff;
    const addr_high = (useaddr >> 8) & 0xff;
    const opt = {
      cmd: [Statics.Cmnd_STK_LOAD_ADDRESS, addr_low, addr_high],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    sendCommand(stream, opt, (err, data) => {
      this.log("loaded address", err, data);
      done(err, data);
    });
  }

  loadPage(stream, writeBytes, timeout, done) {
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
    sendCommand(stream, opt, (err, data) => {
      this.log("loaded page", err, data);
      done(err, data);
    });
  }

  upload(stream, hex, pageSize, timeout, use_8_bit_addresseses, done) {
    this.log("program");

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    async.whilst(
      () => pageaddr < hex.length,
      (pagedone) => {
        this.log("program page");
        async.series(
          [
            (cbdone) => {
              useaddr = use_8_bit_addresseses ? pageaddr : pageaddr >> 1;
              cbdone();
            },
            (cbdone) => {
              this.loadAddress(stream, useaddr, timeout, cbdone);
            },
            (cbdone) => {
              writeBytes = hex.slice(
                pageaddr,
                hex.length > pageSize ? pageaddr + pageSize : hex.length - 1
              );
              cbdone();
            },
            (cbdone) => {
              this.loadPage(stream, writeBytes, timeout, cbdone);
            },
            (cbdone) => {
              this.log("programmed page");
              pageaddr = pageaddr + writeBytes.length;
              setTimeout(cbdone, 4);
            },
          ],
          (error) => {
            this.log("page done");
            pagedone(error);
          }
        );
      },
      (error) => {
        this.log("upload done");
        done(error);
      }
    );
  }

  exitProgrammingMode(stream, timeout, done) {
    this.log("send leave programming mode");
    const opt = {
      cmd: [Statics.Cmnd_STK_LEAVE_PROGMODE],
      responseData: Statics.OK_RESPONSE,
      timeout: timeout,
    };
    sendCommand(stream, opt, (err, data) => {
      this.log("sent leave programming mode", err, data);
      done(err, data);
    });
  }

  verify(stream, hex, pageSize, timeout, use_8_bit_addresseses, done) {
    this.log("verify");

    let pageaddr = 0;
    let writeBytes;
    let useaddr;

    async.whilst(
      () => pageaddr < hex.length,
      (pagedone) => {
        this.log("verify page");
        async.series(
          [
            (cbdone) => {
              useaddr = use_8_bit_addresseses ? pageaddr : pageaddr >> 1;
              cbdone();
            },
            (cbdone) => {
              this.loadAddress(stream, useaddr, timeout, cbdone);
            },
            (cbdone) => {
              writeBytes = hex.slice(
                pageaddr,
                hex.length > pageSize ? pageaddr + pageSize : hex.length - 1
              );
              cbdone();
            },
            (cbdone) => {
              this.verifyPage(stream, writeBytes, pageSize, timeout, cbdone);
            },
            (cbdone) => {
              this.log("verified page");
              pageaddr = pageaddr + writeBytes.length;
              setTimeout(cbdone, 4);
            },
          ],
          (error) => {
            this.log("verify done");
            pagedone(error);
          }
        );
      },
      (error) => {
        this.log("verify done");
        done(error);
      }
    );
  }

  verifyPage(stream, writeBytes, pageSize, timeout, done) {
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
    sendCommand(stream, opt, (err, data) => {
      this.log("confirm page", err, data, data.toString("hex"));
      done(err, data);
    });
  }

  bootload(stream, hex, opt, use_8_bit_addresseses, done) {
    const parameters = {
      pagesizehigh: (opt.pagesizehigh << 8) & 0xff,
      pagesizelow: opt.pagesizelow & 0xff,
    };

    async.series(
      [
        this.sync.bind(this, stream, 3, opt.timeout),
        this.sync.bind(this, stream, 3, opt.timeout),
        this.sync.bind(this, stream, 3, opt.timeout),
        this.verifySignature.bind(this, stream, opt.signature, opt.timeout),
        this.setOptions.bind(this, stream, parameters, opt.timeout),
        this.enterProgrammingMode.bind(this, stream, opt.timeout),
        this.upload.bind(
          this,
          stream,
          hex,
          opt.pageSize,
          opt.timeout,
          use_8_bit_addresseses
        ),
        this.verify.bind(
          this,
          stream,
          hex,
          opt.pageSize,
          opt.timeout,
          use_8_bit_addresseses
        ),
        this.exitProgrammingMode.bind(this, stream, opt.timeout),
      ],
      (error) => {
        return done(error);
      }
    );
  }
}

export default STK500;
