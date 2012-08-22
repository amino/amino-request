var http = require('http')
  , amino = require('amino')
  , Service = require('./service')

module.exports = function createProtocol (options) {

  function Agent () {
    this.httpAgent = new http.Agent(options);
    this.services = {};
  }

  // Entry point. ClientRequest will call this.
  // All we're doing is asynchronously retrieving a spec (host + port) given the
  // virtual host, and passing that to a real HTTP agent.
  Agent.prototype.addRequest = function (req, service) {
    var self = this;
    req.on('spec', function (spec) {
      self.httpAgent.addRequest(req, spec.host, spec.port);
    });

    if (!this.services[service]) {
      this.services[service] = new Service(options);
    }

    this.services[service].addRequest(req, service);
  };

  // Add our custom agent.
  var proto = {};
  proto.Agent = Agent;
  proto.globalAgent = new Agent(options);

  return proto;
};