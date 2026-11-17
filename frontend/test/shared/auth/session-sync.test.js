import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStore } from '../../../src/shared/auth/session-store.js';
import {
  SESSION_CHANNEL,
  connectSessionSync,
  reloadOnPageRestore,
} from '../../../src/shared/auth/session-sync.js';

const SESSION = { accessToken: 'token-1', user: { id: 'u1', role: 'MANAGER' } };

/** Minimal BroadcastChannel: delivers to the other members, never to the sender. */
function createFakeBus() {
  const members = new Set();
  return {
    create(name) {
      const channel = {
        name,
        closed: false,
        onmessage: null,
        posted: [],
        postMessage(data) {
          channel.posted.push(data);
          members.forEach((other) => {
            if (other !== channel) other.onmessage?.({ data });
          });
        },
        close() {
          channel.closed = true;
          members.delete(channel);
        },
      };
      members.add(channel);
      return channel;
    },
  };
}

function createTab(bus) {
  const store = createSessionStore();
  let channel;
  const disconnect = connectSessionSync(store, {
    createChannel: (name) => (channel = bus.create(name)),
  });
  return { store, channel, disconnect };
}

describe('Session sync across tabs (AA04)', () => {
  it('does nothing when BroadcastChannel is unavailable', () => {
    const store = createSessionStore();
    const disconnect = connectSessionSync(store, { createChannel: () => null });
    store.start(SESSION);
    store.end();
    assert.equal(typeof disconnect, 'function');
    disconnect();
  });

  it('ends the session in the other tabs when one tab logs out', () => {
    const bus = createFakeBus();
    const tabA = createTab(bus);
    const tabB = createTab(bus);
    tabA.store.start(SESSION);
    tabB.store.start(SESSION);

    tabA.store.end();

    assert.equal(tabB.store.getState().status, 'anonymous');
    assert.equal(tabB.store.getAccessToken(), null);
    assert.equal(tabB.store.getState().user, null);
    assert.equal(tabA.channel.name, SESSION_CHANNEL);
  });

  it('does not echo the event back (no ping-pong between tabs)', () => {
    const bus = createFakeBus();
    const tabA = createTab(bus);
    const tabB = createTab(bus);
    tabA.store.start(SESSION);
    tabB.store.start(SESSION);

    tabA.store.end();

    assert.equal(tabA.channel.posted.length, 1);
    assert.equal(tabB.channel.posted.length, 0);
  });

  it('never sends tokens or user data', () => {
    const bus = createFakeBus();
    const tabA = createTab(bus);
    createTab(bus);
    tabA.store.start(SESSION);

    tabA.store.end({ expired: true });

    assert.deepEqual(tabA.channel.posted, [{ type: 'SESSION_ENDED' }]);
  });

  it('ignores the event in tabs that are not authenticated and unknown messages', () => {
    const bus = createFakeBus();
    const tabA = createTab(bus);
    const tabB = createTab(bus);
    tabA.store.start(SESSION);

    tabB.channel.onmessage({ data: { type: 'OTHER' } });
    tabA.store.end();

    assert.equal(tabB.store.getState().status, 'unknown');
  });

  it('stops listening and closes the channel on disconnect', () => {
    const bus = createFakeBus();
    const tabA = createTab(bus);
    tabA.store.start(SESSION);

    tabA.disconnect();
    tabA.store.end();

    assert.equal(tabA.channel.closed, true);
    assert.equal(tabA.channel.posted.length, 0);
  });
});

describe('Reload on back/forward cache restore (AA04)', () => {
  function createFakeWindow() {
    const listeners = new Map();
    return {
      reloads: 0,
      location: { reload() { win.reloads++; } },
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type) => listeners.delete(type),
      fire: (type, event) => listeners.get(type)?.(event),
      has: (type) => listeners.has(type),
    };
  }
  const win = createFakeWindow();

  it('reloads only when the page comes from the bfcache', () => {
    reloadOnPageRestore(win);
    win.fire('pageshow', { persisted: false });
    assert.equal(win.reloads, 0);
    win.fire('pageshow', { persisted: true });
    assert.equal(win.reloads, 1);
  });

  it('removes the listener', () => {
    const remove = reloadOnPageRestore(win);
    remove();
    assert.equal(win.has('pageshow'), false);
  });

  it('is a no-op without a window', () => {
    assert.equal(typeof reloadOnPageRestore(undefined), 'function');
  });
});
