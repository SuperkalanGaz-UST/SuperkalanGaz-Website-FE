import assert from 'node:assert/strict';
import test from 'node:test';
import { gpsRegistrationNotice, trackerDestination, trackerSmsCommands } from '../src/app/branch-manager/screens/vehicles/traccar-setup.ts';

test('standard hardware instructions target public H02 ingress, not the private API', () => {
    assert.deepEqual(trackerDestination, { host: '34.158.48.168', port: 5013, protocol: 'H02' });
    assert.equal(trackerSmsCommands[3].command, '8040000 34.158.48.168 5013');
    assert.equal(trackerSmsCommands[0].command, 'RCONF');
    assert.equal(trackerSmsCommands.at(-1).command, 'RCONF');
    assert.equal(trackerSmsCommands[1].command, '8030000 APN');
    assert.equal(trackerSmsCommands[2].command, '7100000');
    assert.ok(trackerSmsCommands.every(({ command }) => !/10\.60\.|8082|https:/.test(command)));
});

test('success notice requires a separate live reception check', () => {
    assert.equal(gpsRegistrationNotice('ABC 123'), 'ABC 123: device registered in Traccar. Live GPS reception still needs verification.');
});
