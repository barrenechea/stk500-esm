import type { Duplex } from "node:stream";
import Constants from "./constants.js";

const startingBytes = [Constants.Resp_STK_INSYNC];

/**
 * Receives data from a stream, looking for specific starting bytes.
 *
 * @param stream - The read/write stream to receive data from.
 * @param timeout - The maximum time to wait for data, in milliseconds.
 * @param responseLength - The expected length of the response.
 * @returns A promise that resolves with the received data as a Uint8Array.
 * @throws Will throw an error if the timeout is reached or if the received data exceeds the expected length.
 */
export default function receiveData(
  stream: Duplex,
  timeout: number,
  responseLength: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let buffer = new Uint8Array(0);
    let started = false;
    let timeoutId: NodeJS.Timeout;

    const handleChunk = (data: Uint8Array) => {
      if (!started) {
        const startIndex = Array.from(data).findIndex((byte) =>
          startingBytes.includes(byte)
        );
        if (startIndex !== -1) {
          data = data.subarray(startIndex);
          started = true;
        } else {
          return; // Skip this chunk if starting byte not found
        }
      }

      buffer = new Uint8Array([...buffer, ...data]);

      if (buffer.length > responseLength) {
        finished(
          new Error(`Buffer overflow ${buffer.length} > ${responseLength}`)
        );
      } else if (buffer.length === responseLength) {
        finished();
      }
    };

    const finished = (err?: Error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      stream.removeListener("data", handleChunk);

      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    };

    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        finished(new Error(`receiveData timeout after ${timeout}ms`));
      }, timeout);
    }

    stream.on("data", handleChunk);
  });
}
