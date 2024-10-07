import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import Statics from "../lib/statics.js";
import sendCommand from "../lib/sendCommand.js";

describe("sendCommands", () => {
  let hardware;

  beforeEach(() => {
    hardware = new EventEmitter();
    hardware.write = (data, callback) => {
      callback(null, data);
    };
    hardware.insert = (data) => {
      hardware.emit("data", data);
    };
  });

  afterEach(() => {
    hardware.removeAllListeners();
  });

  test("should write a buffer command", async (t) => {
    const cmd = Buffer.from([Statics.Cmnd_STK_GET_SYNC, Statics.Sync_CRC_EOP]);
    const opt = {
      cmd: cmd,
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    let writeCalled = false;
    hardware.write = (data, callback) => {
      writeCalled = true;
      assert(data.equals(cmd));
      callback(null, data);
    };

    setTimeout(() => {
      hardware.insert(Statics.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(writeCalled);
    assert(data.equals(Statics.OK_RESPONSE));
  });

  test("should write an array command", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    let writeCalled = false;
    hardware.write = (data, callback) => {
      writeCalled = true;
      assert(
        data.equals(
          Buffer.from([Statics.Cmnd_STK_GET_SYNC, Statics.Sync_CRC_EOP])
        )
      );
      callback(null, data);
    };

    setTimeout(() => {
      hardware.insert(Statics.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(writeCalled);
    assert(data.equals(Statics.OK_RESPONSE));
  });

  test("should timeout", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    await assert.rejects(sendCommand(hardware, opt), {
      message: "Sending 3020: receiveData timeout after 10ms",
    });
  });

  test("should get n number of bytes", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseLength: 2,
      timeout: 10,
    };

    setTimeout(() => {
      hardware.insert(Statics.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(data.equals(Statics.OK_RESPONSE));
  });

  test("should match response", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    setTimeout(() => {
      hardware.insert(Statics.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(data.equals(Statics.OK_RESPONSE));
  });
});
