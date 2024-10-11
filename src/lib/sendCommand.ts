import receiveData from "./receiveData.js";
import Constants from "./constants.js";

/**
 * Options for sending a command to the device.
 */
interface SendCommandOptions {
  /** The command to send, as a Uint8Array or array of numbers. */
  cmd: Uint8Array | number[];
  /** The timeout duration in milliseconds (optional). */
  timeout?: number;
  /** The expected response data (optional). */
  responseData?: Uint8Array;
  /** The expected length of the response (optional). */
  responseLength?: number;
}

/**
 * Sends a command to the device and waits for a response.
 *
 * @param stream - The read/write stream for communication with the device.
 * @param opt - Options for the command, including the command itself and response expectations.
 * @returns A promise that resolves with the response data as a Uint8Array.
 * @throws Will throw an error if sending fails, if the response doesn't match expectations, or if a timeout occurs.
 */
export default async function sendCommand(
  stream: NodeJS.ReadWriteStream,
  opt: SendCommandOptions
): Promise<Uint8Array> {
  const timeout = opt.timeout ?? 0;
  let responseData: Uint8Array | null = null;
  let responseLength = 0;

  if (opt.responseData && opt.responseData.length > 0) {
    responseData = opt.responseData;
  }
  if (responseData) {
    responseLength = responseData.length;
  }
  if (opt.responseLength) {
    responseLength = opt.responseLength;
  }

  let cmd: Uint8Array;
  if (Array.isArray(opt.cmd)) {
    cmd = new Uint8Array([...opt.cmd, Constants.Sync_CRC_EOP]);
  } else {
    cmd = opt.cmd;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      stream.write(cmd, (err) => {
        if (err) {
          reject(
            new Error(
              `Sending ${Array.from(cmd)
                .map((b) => b.toString(16))
                .join("")}: ${err.message}`
            )
          );
        } else {
          resolve();
        }
      });
    });

    const data = await receiveData(stream, timeout, responseLength);

    if (
      responseData &&
      !data.every((value, index) => value === responseData[index])
    ) {
      throw new Error(
        `${Array.from(cmd)
          .map((b) => b.toString(16))
          .join("")} response mismatch: ${Array.from(data)
          .map((b) => b.toString(16))
          .join("")}, ${Array.from(responseData)
          .map((b) => b.toString(16))
          .join("")}`
      );
    }

    return data;
  } catch (error: unknown) {
    throw new Error(
      `Sending ${Array.from(cmd)
        .map((b) => b.toString(16))
        .join("")}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
