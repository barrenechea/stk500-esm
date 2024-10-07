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

    const promise = new Promise((resolve) => {
      sendCommand(hardware, opt, (err, data) => {
        assert.ifError(err);
        assert(writeCalled);
        resolve();
      });
    });

    process.nextTick(() => {
      hardware.insert(Statics.OK_RESPONSE);
    });

    await promise;
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

    const promise = new Promise((resolve) => {
      sendCommand(hardware, opt, (err, data) => {
        assert.ifError(err);
        assert(writeCalled);
        resolve();
      });
    });

    process.nextTick(() => {
      hardware.insert(Statics.OK_RESPONSE);
    });

    await promise;
  });

  test("should timeout", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    const promise = new Promise((resolve) => {
      sendCommand(hardware, opt, (err, data) => {
        assert(err);
        assert.equal(
          err.message,
          "Sending 3020: receiveData timeout after 10ms"
        );
        resolve();
      });
    });

    await promise;
  });

  test("should get n number of bytes", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseLength: 2,
      timeout: 10,
    };

    const promise = new Promise((resolve) => {
      sendCommand(hardware, opt, (err, data) => {
        assert.ifError(err);
        assert(data.equals(Statics.OK_RESPONSE));
        resolve();
      });
    });

    process.nextTick(() => {
      hardware.insert(Statics.OK_RESPONSE);
    });

    await promise;
  });

  test("should match response", async (t) => {
    const opt = {
      cmd: [Statics.Cmnd_STK_GET_SYNC],
      responseData: Statics.OK_RESPONSE,
      timeout: 10,
    };

    const promise = new Promise((resolve) => {
      sendCommand(hardware, opt, (err, data) => {
        assert.ifError(err);
        assert(data.equals(Statics.OK_RESPONSE));
        resolve();
      });
    });

    process.nextTick(() => {
      hardware.insert(Statics.OK_RESPONSE);
    });

    await promise;
  });
});
