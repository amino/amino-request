var getProtocol = require('./lib/protocol')
  , ServiceRequest = require('./lib/service-request')
  , http = require('http')
  , https = require('https')
  , request = require('request')
  , Spec = require('amino-spec')

exports.attach = function (options) {
  var amino = this;
  amino.protocol = getProtocol(options);

  var customRequest = request.defaults({
    httpModules: { 'amino:': amino.protocol, 'http:': http, 'https:': https },
    json: true
  });

  amino.request = function (service, path, cb) {
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

  amino.requestService = function (reqSpec, cb) {
    reqSpec = new Spec(reqSpec);
    var req = new ServiceRequest(reqSpec);
    req.on('spec', cb);
    amino.protocol.globalAgent.addRequest(req, reqSpec.service);
    return req;
  };
};