var http = require('http')
  , Service = require('./service')
  , url = require('url')

module.exports = function getAgent (options) {

  function Agent () {
    this.httpAgent = new http.Agent(options);
    this.services = {};
  }

  // Entry point. ClientRequest will call this.
  // All we're doing is asynchronously retrieving a spec (host + port) given the
  // virtual host, and passing that to a real HTTP agent.
  Agent.prototype.addRequest = function (req, service) {
		// Fix for node 5.5.0+ where service contains options instead of hostname
    if (service.href) {
      service = url.parse(service.href).hostname;
    }
    var self = this;
    if (!req.listeners('spec').length) {
      req.on('spec', function (spec) {
        self.httpAgent.addRequest(req, spec.host, spec.port);
      });
    }

    if (!this.services[service]) {
      this.services[service] = new Service(service, options);
    }

    this.services[service].addRequest(req, service);
  };

  Agent.prototype.reset = function () {
    var self = this;
    Object.keys(this.services).forEach(function (k) {
      self.services[k].close();
    });
    this.services = [];
  };

  return Agent;
};