var createProtocol = require('./protocol')
  , request = require('request')
  , http = require('http')
  , https = require('https')

exports.attach = function (options) {
  this.request = request.defaults({
    httpModules: { 'amino:': createProtocol(options), 'http:': http, 'https:': https },
    json: true
  });
};