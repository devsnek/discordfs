require('promise_util');
const request = require('./APIRequest');

class Ratelimiter {
  constructor(client) {
    this.client = client;
    this.routes = {};
    this.global = false;
  }

  getRoute(path) {
    const split = path.split('/');
    return split.map((r, i) => {
      if (/\d{16,19}/g.test(r)) return /channels|guilds/.test(split[i - 1]) ? r : ':id';
      return r;
    }).join('/');
  }

  handle(route) {
    if (this.global || route.remaining <= 0 || route.queue.length <= 0 || route.busy) return;
    const item = route.queue.shift();
    route.busy = true;
    item.request().end((err, res) => {
      if (res && res.headers) {
        if (res.headers['x-ratelimit-global']) this.global = true;
        route.limit = Number(res.headers['x-ratelimit-limit']);
        route.resetTime = Number(res.headers['x-ratelimit-reset']) * 1000;
        route.remaining = Number(res.headers['x-ratelimit-remaining']);
        route.timeDifference = Date.now() - new Date(res.headers.date).getTime();
      }
      if (err) {
        if (err.status === 429) {
          route.queue.unshift(item);
          setTimeout(() => {
            route.busy = false;
            this.global = false;
            this.handle(route);
          }, route.resetTime - Date.now() + route.timeDifference);
        } else if (err.status === 500) {
          route.queue.unshift(item);
          setTimeout(() => {
            route.busy = false;
            this.handle(route);
          }, 1e3);
        } else {
          item.promise.reject(err);
          route.busy = false;
          this.handle(route);
        }
      } else {
        item.promise.resolve(res);
        if (route.remaining <= 0) {
          setTimeout(() => {
            route.busy = false;
            route.remaining = 1;
            this.handle(route);
          }, route.resetTime - Date.now() + route.timeDifference);
        } else {
          route.busy = false;
          this.handle(route);
        }
      }
    });
  }

  queue(method, path, options) {
    const p = Promise.create();
    const route = this.getRoute(path);
    if (!this.routes[route]) {
      this.routes[route] = {
        queue: [],
        remaining: 1,
        resetTime: null,
        limit: Infinity,
        timeDifference: 0,
        busy: false,
      };
    }
    this.routes[route].queue.push({
      request: request(this.client, method, path, options),
      promise: p,
    });
    this.handle(this.routes[route]);
    return p;
  }
}

module.exports = Ratelimiter;
