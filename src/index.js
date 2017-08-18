const Fused = require('fused');
const Router = require('./rest/Router');

const f = new Fused();

const mode = {
  owner: {
    read: true,
    write: true,
    execute: true,
  },
  group: {
    read: true,
    execute: true,
  },
  others: {
    read: true,
    execute: true,
  },
};

const router = new Router({
  token: null,
});

f.add('/gateway', {
  type: 'file',
  content(data, cb) {
    if (data) return cb();
    return router.get('/gateway').then(JSON.stringify);
  },
  mode,
});

f.add('/token', {
  type: 'file',
  content(data, cb) {
    if (data) {
      router.client.token = data.trim();
      return cb();
    } else {
      return cb(router.client.token);
    }
  },
  mode,
});

const genericHandler = (path) => ({
  type: /^\/(channels|users|guilds)$/.test(path) ? 'dir' : 'file',
  content(data) {
    if (!data) return router.get(path).then(JSON.stringify);
    return router.post(path, { data: JSON.parse(data) }).then(() => '');
  },
  mode,
});

f.add(/\/channels(\/\d{17,19}(\/messages(\/\d{17,19})?)?)?/, genericHandler);
f.add(/\/guilds(\/\d{17,19}(\/members\/\d{17,19})?)?/, genericHandler);
f.add(/\/users(\/(\d{17,19}|@me))?/, genericHandler);

f.mount('./discord')
  .then(() => console.log('Mounted!')); // eslint-disable-line no-console
