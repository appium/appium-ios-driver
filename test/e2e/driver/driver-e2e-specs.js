// transpile:mocha

import _ from 'lodash';
import env from '../helpers/env';
import { IosDriver } from '../../../lib/driver';
import { rootDir } from '../../../lib/utils';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import B from 'bluebird';
import { MOCHA_TIMEOUT } from '../helpers/session';


chai.should();
chai.use(chaiAsPromised);

describe('driver', function () {
  this.timeout(MOCHA_TIMEOUT);
  let driver;
  let caps = {
    app: path.resolve(rootDir, 'test', 'assets', 'TestApp.zip'),
    platformName: 'iOS',
    showIOSLog: false,
    noReset: true,
    newCommandTimeout: 120
  };
  caps = _.merge({}, env.CAPS, caps);

  it('should start', async () => {
    driver = new IosDriver();
    await driver.createSession(caps);
  });

  it('should return server details', async () => {
    let serverCaps = await driver.getSession();
    serverCaps.takesScreenshot.should.exist;
  });

  it('should stop', async () => {
    await B.delay(2000);
    await driver.deleteSession();
  });

  it('should accept W3C parameters', async () => {
    let w3cCaps = {
      alwaysMatch: _.merge({}, env.CAPS, caps),
      firstMatch: [{}],
    };
    driver = new IosDriver();
    let [sessionId, modifiedCaps] = await driver.createSession(null, null, w3cCaps);
    sessionId.should.exist;
    modifiedCaps.should.exist;
  });
});
