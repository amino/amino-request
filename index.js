var getProtocol = require('./lib/protocol')
  , http = require('http')
  , https = require('https')
  , request = require('request')
  , Spec = require('amino-spec')

exports.attach = function (options) {
  var customRequest = request.defaults({
    httpModules: { 'amino:': getProtocol(options), 'http:': http, 'https:': https },
    json: true
  });

  this.request = function (service, path, cb) {
    if (typeof service === 'object' || (typeof service === 'string' && service.indexOf('://') !== -1)) {
      cb = path;
      return customRequest(service, cb);
    }
    var spec = new Spec(service);
    var opts = {
      url: 'amino://' + spec.service + path,
      headers: { 'X-Amino-Version': spec.version }
    };

    return customRequest(opts, cb);
  };
};