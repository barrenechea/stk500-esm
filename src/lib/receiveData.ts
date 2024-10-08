import Constants from "./constants.js";

const startingBytes = [Constants.Resp_STK_INSYNC];

/**
 * Receives data from a stream, looking for specific starting bytes.
 *
 * @param stream - The read/write stream to receive data from.
 * @param timeout - The maximum time to wait for data, in milliseconds.
 * @param responseLength - The expected length of the response.
 * @returns A promise that resolves with the received data as a Buffer.
 * @throws Will throw an error if the timeout is reached or if the received data exceeds the expected length.
 */
export default function receiveData(
  stream: NodeJS.ReadWriteStream,
  timeout: number,
  responseLength: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let started = false;
    let timeoutId: NodeJS.Timeout;

    const handleChunk = (data: Buffer) => {
      if (!started) {
        const startIndex = data.findIndex((byte) =>
          startingBytes.includes(byte)
        );
        if (startIndex !== -1) {
          data = data.slice(startIndex);
          started = true;
        } else {
          return; // Skip this chunk if starting byte not found
        }
      }

      buffer = Buffer.concat([buffer, data]);

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
