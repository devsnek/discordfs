const fuse = require('fuse-bindings');
const Ratelimiter = require('./Ratelimiter');

class Router {
  constructor(client) {
    this.client = client;
    this.ratelimiter = new Ratelimiter(this.client);
  }
}

const StatusMap = {
  200: 0,
  401: fuse.EPERM,
  403: fuse.EPERM,
  404: fuse.ENOENT,
};

for (const method of ['get', 'post', 'delete', 'patch', 'put']) {
  Router.prototype[method] = function http(path, options = {}) {
    return this.ratelimiter.queue(method, path, options)
      .catch((r) => r)
      .then((res) => {
        if (options.fuse) options.fuse(StatusMap[res.status], res.text);
        return res.body;
      });
  };
}

module.exports = Router;
