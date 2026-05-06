import pino from 'pino';
let callCount = 0;
const testStream = {
  write: (msg) => {
    callCount++;
    const obj = JSON.parse(msg.trim());
    process.stdout.write('WRITE CALLED level:' + obj.level + ' msg:' + obj.msg + '\n');
  }
};
const logger = pino({ level: 'warn' }, testStream);
logger.warn('test warn');
logger.error('test error');
process.stdout.write('Total calls: ' + callCount + '\n');
