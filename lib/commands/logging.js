import _ from 'lodash';
import IOSLog from '../device-log/ios-log';
import IOSCrashLog from '../device-log/ios-crash-log';
import logger from '../logger';

const GET_SERVER_LOGS_FEATURE = 'get_server_logs';


let commands = {}, helpers = {}, extensions = {};

extensions.extractLogs = async function extractLogs (logType, logsContainer = {}) {
  // make sure that we have logs at all
  // otherwise it's not been initialized
  if (_.isEmpty(logsContainer)) {
    throw new Error('No logs currently available. Is the device/simulator started?');
  }

  // If logs captured successfully send response with data, else send error
  const logObject = logsContainer[logType];
  const logs = logObject ? await logObject.getLogs() : null;
  if (logs) {
    return logs;
  }
  throw new Error(`No logs of type '${logType}' found.`);
};

extensions.supportedLogTypes = {
  syslog: {
    description: 'System Logs - Device logs for iOS applications on real devices and simulators',
    getter: async (self) => await self.extractLogs('syslog', self.logs),
  },
  crashlog: {
    description: 'Crash Logs - Crash reports for iOS applications on real devices and simulators',
    getter: async (self) => await self.extractLogs('crashlog', self.logs),
  },
  performance: {
    description: 'Performance Logs - Debug Timelines on real devices and simulators',
    getter: async (self) => await self.extractLogs('performance', self.logs),
  },
  server: {
    description: 'Appium server logs',
    getter: (self) => {
      self.ensureFeatureEnabled(GET_SERVER_LOGS_FEATURE);
      return logger.unwrap().record
        .map(function (x) {
          return {
            // npmlog does not keep timestamps in the history
            timestamp: Date.now(),
            level: 'ALL',
            message: _.isEmpty(x.prefix) ? x.message : `[${x.prefix}] ${x.message}`,
          };
        });
    },
  },
};

helpers.startLogCapture = async function startLogCapture (sim) {
  if (!_.isEmpty(this.logs)) {
    logger.warn("Trying to start iOS log capture but it's already started!");
    return;
  }
  this.logs.crashlog = new IOSCrashLog();
  this.logs.syslog = new IOSLog({
    sim,
    udid: this.opts.udid,
    showLogs: this.opts.showIOSLog,
    realDeviceLogger: this.opts.realDeviceLogger,
    xcodeVersion: this.xcodeVersion,
  });
  try {
    await this.logs.syslog.startCapture();
  } catch (err) {
    logger.warn('Could not capture logs from device. Continuing without capturing logs.');
    return;
  }
  await this.logs.crashlog.startCapture();
};


Object.assign(extensions, commands, helpers);
export { commands, helpers };
export default extensions;
