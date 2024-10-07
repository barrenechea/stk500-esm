import Statics from "./statics.js";

const startingBytes = [Statics.Resp_STK_INSYNC];

function receiveData(stream, timeout, responseLength) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let started = false;
    let timeoutId = null;

    const handleChunk = (data) => {
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

    const finished = (err) => {
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

export default receiveData;
