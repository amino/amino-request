var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits

function ServiceRequest (options) {
  this.headers = {};
  if (options.stickyId) {
    this.headers['X-Amino-StickyId'] = options.stickyId;
  }
  if (options.service) {
    this.headers['X-Amino-Service'] = options.service;
    if (options.version) {
      this.headers['X-Amino-Service'] += '@' + options.version;
    }
  }
}
inherits(ServiceRequest, EventEmitter);
module.exports = ServiceRequest;