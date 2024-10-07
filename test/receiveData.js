const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Statics = require("../lib/statics");
const receiveData = require("../lib/receiveData");
const { Readable } = require("node:stream");

describe("receiveData", () => {
  let port;

  beforeEach(() => {
    port = new Readable({
      read() {},
    });
    port.write = function (data) {
      this.push(data);
    };
  });

  test("should receive a matching buffer", async (t) => {
    const inputBuffer = Statics.OK_RESPONSE;
    const promise = new Promise((resolve) => {
      receiveData(port, 10, inputBuffer.length, (err, data) => {
        assert.ifError(err);
        assert(data.equals(inputBuffer));
        resolve();
      });
    });
    port.write(inputBuffer);
    await promise;
  });

  test("should timeout", async (t) => {
    const inputBuffer = Statics.OK_RESPONSE;
    const promise = new Promise((resolve) => {
      receiveData(port, 10, inputBuffer.length, (err, data) => {
        assert(err);
        assert.equal(err.message, "receiveData timeout after 10ms");
        resolve();
      });
    });
    port.write(inputBuffer.slice(0, 1));
    await promise;
  });

  test("should receive a buffer in chunks", async (t) => {
    const inputBuffer = Statics.OK_RESPONSE;
    const promise = new Promise((resolve) => {
      receiveData(port, 10, inputBuffer.length, (err, data) => {
        assert.ifError(err);
        assert(data.equals(inputBuffer));
        resolve();
      });
    });
    port.write(inputBuffer.slice(0, 1));
    port.write(inputBuffer.slice(1, 2));
    await promise;
  });
});
