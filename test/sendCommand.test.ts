import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import Constants from "../src/lib/constants.js";
import sendCommand from "../src/lib/sendCommand.js";

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

  test("should write a buffer command", async () => {
    const cmd = Buffer.from([
      Constants.Cmnd_STK_GET_SYNC,
      Constants.Sync_CRC_EOP,
    ]);
    const opt = {
      cmd: cmd,
      responseData: Constants.OK_RESPONSE,
      timeout: 10,
    };

    let writeCalled = false;
    hardware.write = (data, callback) => {
      writeCalled = true;
      assert(data.equals(cmd));
      callback(null, data);
    };

    setTimeout(() => {
      hardware.insert(Constants.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(writeCalled);
    assert(data.equals(Constants.OK_RESPONSE));
  });

  test("should write an array command", async () => {
    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseData: Constants.OK_RESPONSE,
      timeout: 10,
    };

    let writeCalled = false;
    hardware.write = (data, callback) => {
      writeCalled = true;
      assert(
        data.equals(
          Buffer.from([Constants.Cmnd_STK_GET_SYNC, Constants.Sync_CRC_EOP])
        )
      );
      callback(null, data);
    };

    setTimeout(() => {
      hardware.insert(Constants.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(writeCalled);
    assert(data.equals(Constants.OK_RESPONSE));
  });

  test("should timeout", async () => {
    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseData: Constants.OK_RESPONSE,
      timeout: 10,
    };

    await assert.rejects(sendCommand(hardware, opt), {
      message: "Sending 3020: receiveData timeout after 10ms",
    });
  });

  test("should get n number of bytes", async () => {
    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseLength: 2,
      timeout: 10,
    };

    setTimeout(() => {
      hardware.insert(Constants.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(data.equals(Constants.OK_RESPONSE));
  });

  test("should match response", async () => {
    const opt = {
      cmd: [Constants.Cmnd_STK_GET_SYNC],
      responseData: Constants.OK_RESPONSE,
      timeout: 10,
    };

    setTimeout(() => {
      hardware.insert(Constants.OK_RESPONSE);
    }, 0);

    const data = await sendCommand(hardware, opt);
    assert(data.equals(Constants.OK_RESPONSE));
  });
});
