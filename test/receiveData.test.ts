import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Constants from "../src/lib/constants.js";
import receiveData from "../src/lib/receiveData.js";
import { Readable } from "node:stream";

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

  test("should receive a matching buffer", async () => {
    const inputBuffer = Constants.OK_RESPONSE;
    port.write(inputBuffer);
    const data = await receiveData(port, 10, inputBuffer.length);
    assert(data.equals(inputBuffer));
  });

  test("should timeout", async () => {
    const inputBuffer = Constants.OK_RESPONSE;
    port.write(inputBuffer.subarray(0, 1));
    await assert.rejects(receiveData(port, 10, inputBuffer.length), {
      message: "receiveData timeout after 10ms",
    });
  });

  test("should receive a buffer in chunks", async () => {
    const inputBuffer = Constants.OK_RESPONSE;
    port.write(inputBuffer.subarray(0, 1));
    setTimeout(() => {
      port.write(inputBuffer.subarray(1, 2));
    }, 5);
    const data = await receiveData(port, 20, inputBuffer.length);
    assert(data.equals(inputBuffer));
  });
});
