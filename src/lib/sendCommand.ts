import receiveData from "./receiveData.js";
import Constants from "./constants.js";

/**
 * Options for sending a command to the device.
 */
interface SendCommandOptions {
  /** The command to send, as a Buffer or array of numbers. */
  cmd: Buffer | number[];
  /** The timeout duration in milliseconds (optional). */
  timeout?: number;
  /** The expected response data (optional). */
  responseData?: Buffer;
  /** The expected length of the response (optional). */
  responseLength?: number;
}

/**
 * Sends a command to the device and waits for a response.
 *
 * @param stream - The read/write stream for communication with the device.
 * @param opt - Options for the command, including the command itself and response expectations.
 * @returns A promise that resolves with the response data as a Buffer.
 * @throws Will throw an error if sending fails, if the response doesn't match expectations, or if a timeout occurs.
 */
export default async function sendCommand(
  stream: NodeJS.ReadWriteStream,
  opt: SendCommandOptions
): Promise<Buffer> {
  const timeout = opt.timeout ?? 0;
  let responseData = null;
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

  let cmd = opt.cmd;
  if (Array.isArray(cmd)) {
    cmd = Buffer.from(cmd.concat(Constants.Sync_CRC_EOP));
  }

  try {
    await new Promise<void>((resolve, reject) => {
      stream.write(cmd, (err) => {
        if (err) {
          reject(new Error(`Sending ${cmd.toString("hex")}: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    const data = await receiveData(stream, timeout, responseLength);

    if (responseData && !data.equals(responseData)) {
      throw new Error(
        `${cmd.toString("hex")} response mismatch: ${data.toString(
          "hex"
        )}, ${responseData.toString("hex")}`
      );
    }

    return data;
  } catch (error: unknown) {
    throw new Error(
      `Sending ${cmd.toString("hex")}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
