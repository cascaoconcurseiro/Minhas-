import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicSmtpAddress, resolvePublicSmtpTarget } from './smtpSecurity';

test('allows public unicast addresses and rejects private or special IPv4 ranges', () => {
  assert.equal(isPublicSmtpAddress('8.8.8.8'), true);
  assert.equal(isPublicSmtpAddress('1.1.1.1'), true);
  for (const address of [
    '0.0.0.1', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.1.1',
    '172.16.0.1', '192.0.2.1', '192.168.1.1', '198.18.0.1',
    '198.51.100.10', '203.0.113.10', '224.0.0.1', '255.255.255.255',
  ]) {
    assert.equal(isPublicSmtpAddress(address), false, address);
  }
});

test('allows public global IPv6 and rejects private, loopback, mapped, and special ranges', () => {
  assert.equal(isPublicSmtpAddress('2606:4700:4700::1111'), true);
  for (const address of [
    '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1',
    '::ffff:127.0.0.1', '2001:db8::1', '2001::1', '2002::1', '3fff::1',
  ]) {
    assert.equal(isPublicSmtpAddress(address), false, address);
  }
});

test('resolves an SMTP hostname once and pins the approved public address', async () => {
  const target = await resolvePublicSmtpTarget('smtp.example.com', 587, async (host) => {
    assert.equal(host, 'smtp.example.com');
    return [{ address: '203.0.114.7', family: 4 }];
  });
  assert.deepEqual(target, { address: '203.0.114.7', servername: 'smtp.example.com' });
});

test('rejects private DNS answers, invalid hosts, DNS failures, and non-SMTP ports', async () => {
  const mixed = await resolvePublicSmtpTarget('smtp.example.com', 587, async () => [
    { address: '203.0.114.7', family: 4 },
    { address: '10.0.0.8', family: 4 },
  ]);
  assert.equal(mixed, null);
  assert.equal(await resolvePublicSmtpTarget('localhost', 587), null);
  assert.equal(await resolvePublicSmtpTarget('http://smtp.example.com', 587), null);
  assert.equal(await resolvePublicSmtpTarget('smtp.example.com', 3000), null);
  assert.equal(await resolvePublicSmtpTarget('smtp.example.com', 587, async () => { throw new Error('DNS failed'); }), null);
});
