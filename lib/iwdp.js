import { SubProcess } from 'teen_process';
import EventEmitter from 'events';
import logger from './logger';
import axios from 'axios';
import { retryInterval } from 'asyncbox';
import { fs, logger as baseLogger } from 'appium-support';


const IWDP_CMD = 'ios_webkit_debug_proxy';
const MAX_RETRIES = 10;

const iwdpLogger = baseLogger.getLogger('IWDP');

class IWDP extends EventEmitter {
  constructor (opts = {}) {
    super();

    this.udid = opts.udid || null;
    this.logStdout = !!opts.logStdout;
    this.attempts = 0;
    this.port = opts.webkitDebugProxyPort || 27753;
    this.process = this.createIWDPProcess();
    this.endpoint = `http://localhost:${this.port}`;
  }

  createIWDPProcess () {
    // (see https://github.com/google/ios-webkit-debug-proxy for reference)
    const process = new SubProcess(IWDP_CMD, ['-c', `${this.udid}:${this.port}`, '-d']);
    process.on('exit', () => this.onExit());
    process.on('lines-stderr', iwdpLogger.error);
    if (this.logStdout) {
      process.on('lines-stdout', iwdpLogger.debug);
    }
    return process;
  }

  async onExit () {
    // If the process exits and the exit wasn't requested by the API, restart it
    if (!this.exitRequested) {
      this.process = this.createIWDPProcess();
      await this.start();
    }
  }

  async start () {
    if (++this.attempts > MAX_RETRIES) {
      return this.emit('error', new Error(`Failed to start IWDP server. Max retry attempts ${MAX_RETRIES} reached`));
    }
    this.exitRequested = false;

    // Throw error if ios_webkit_debug_proxy is not installed
    if (!await this.isSupported()) {
      logger.errorAndThrow(`'ios_webkit_debug_proxy' not installed on this machine. Try 'brew install ios-webkit-debug-proxy`);
    }

    logger.debug(`Starting ios_webkit_debug_proxy at port ${this.port} on device ${this.udid}`);
    await this.process.start(0);

    // Retry pinging the iwdp server until it's ready
    try {
      await retryInterval(20, 500, async () => await axios({url: this.endpoint}));
      this.emit('start');
    } catch (ign) {
      try {
        await this.process.stop();
      } catch (ign2) { }
      logger.errorAndThrow(`Timed out waiting for ios_webkit_debug_proxy to open`);
    }
  }

  async stop () {
    this.attempts = 0;
    this.exitRequested = true;
    return await this.process.stop();
  }

  /**
	 * Is 'ios_webkit_debug_proxy' available?
	 */
  async isSupported () {
    if (typeof this.supported !== 'undefined') {
      return this.supported;
    }

    try {
      await fs.which(IWDP_CMD);
      this.supported = true;
    } catch (e) {
      this.supported = false;
    }
    return this.supported;
  }
}

export { IWDP };
export default IWDP;
