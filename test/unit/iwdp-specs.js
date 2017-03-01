// transpile:mocha
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import IWDP from '../../lib/iwdp';
import { SubProcess } from 'teen_process';
import request from 'request-promise';
import Promise from 'bluebird';
chai.should();
chai.use(chaiAsPromised);

const { expect } = chai;
let iwdpInstance;

describe('ios webkit debug proxy class', async () => {
  beforeEach(async () => {
    iwdpInstance = new IWDP();
  });

  afterEach(async () => {
    try {
      await iwdpInstance.stop();
    } catch (ign) { }
  });

  it('should detect that IWDP is supported on this machine', function () {
    expect(IWDP.isSupported());
  });

  it('should start IWDP and be able to access the main page', async function () {
    await iwdpInstance.start();
    await request(iwdpInstance.endpoint).should.eventually.have.string('<html'); 
  });

  it('should not keep running after stop is called', async function () {
    await iwdpInstance.start();
    await iwdpInstance.stop();
    request(iwdpInstance.endpoint).should.be.rejected;
  });

  it('should still start IWDP server if one is started on a different port', async function() {
    let process = new SubProcess('ios_webkit_debug_proxy', ['--config', 'null:56789']);
    process.start();
    await Promise.delay(500);
    await request('http://localhost:56789/').should.eventually.have.string('<html');
    await iwdpInstance.start();
    await request(iwdpInstance.endpoint).should.eventually.have.string('<html');
    await process.stop();
  });

  it('should restart after the process is stopped abruptly', async function () {
    await iwdpInstance.start();
    await iwdpInstance.process.stop();
    await new Promise((resolve) => {
      iwdpInstance.once('start', resolve);   
    });
    await request(iwdpInstance.endpoint).should.eventually.have.string('<html');
  });

  it('should fail after reaching max retries', async (done) => {
    await iwdpInstance.start();
    let retries = 0;

    // It should give up restarting after 10 failed attempts
    iwdpInstance.on('error', () => {
      expect(retries).to.equal(10);
      done();
    });

    while (++retries <= 10) {
      let promise = new Promise((resolve) => {
        iwdpInstance.once('start', () => {
          resolve();
        });
      });
      await iwdpInstance.process.stop();
      await promise;
    }
  });
});
