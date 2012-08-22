var amino = require('amino')
  , Spec = require('amino-spec')
  , semver = require('semver')

function Service (name, options) {
  this.name = name;
  options || (options = {});

  // Throttle broadcasts at 5 seconds.
  options.specRequestThrottle = (options.specRequestThrottle || 5000);
  // Broadcast for specs every 120 seconds regardless, to pick up stragglers.
  options.specRequestInterval = (options.specRequestInterval || 120000);
  // Delay before the service is deemed "ready" after getting one or more specs
  options.readyTimeout = (options.readyTimeout || 200);

  this.options = {};
  for (var prop in options) {
    this.options[prop] = options[prop];
  }

  this.init();
}
module.exports = Service;

Service.prototype.init = function () {
  var self = this;

  // Listen for personal responses.
  this.addSpecResponder = this.addSpec.bind(this);
  amino.subscribe('_get:' + this.name + ':' + amino.id, this.addSpecResponder);
  // And broadcasts of new specs.
  amino.subscribe('_spec:' + this.name, this.addSpecResponder);

  // Listen for drop broadcasts.
  self.dropSpecResponder = this.dropSpec.bind(this);
  amino.subscribe('_drop:' + this.name, self.dropSpecResponder);

  if (this.options.specRequestInterval) {
    self.specRequestInterval = setInterval(this.specRequest.bind(this), this.options.specRequestInterval);
  }

  this.specs = [];
  this.requests = [];
};

Service.prototype.close = function () {
  clearInterval(self.specRequestInterval);
  clearTimeout(self.readyTimeout);
  amino.unsubscribe('_get:' + this.name + ':' + amino.id, this.addSpecResponder);
  amino.unsubscribe('_spec:' + this.name, this.addSpecResponder);
  amino.unsubscribe('_drop:' + this.name, self.dropSpecResponder);
};

Service.prototype.addSpec = function (spec) {
  var self = this;
  if (!(spec instanceof Spec)) {
    spec = new Spec(spec);
  }
  for (var idx in this.specs) {
    if (this.specs[idx].id === spec.id) {
      // Already added.
      return;
    }
  }

  if (!this.specs.length) {
    // Delay processing the queue a short while, to improve hash ring integrity
    // when first starting up.
    clearTimeout(this.readyTimeout);

    this.readyTimeout = setTimeout(function () {
      delete self.readyTimeout;
      self.createRing();
      self.nextRequest();
    }, this.options.readyTimeout);
  }
  this.specs.push(spec);
};

Service.prototype.createRing = function (version) {
  this.versionRings || (this.versionRings = {});
  if (version && this.vesionRings[version]) return this.vesionRings[version];

  var specs = this.specs, ring;

  if (version) {
    // Search for specs to satisfy the version.
    specs = this.specs.filter(function (spec) {
      return spec.version && semver.satisfies(spec.version, version);
    });
  }
  else {
    // Clear the version rings cache.
    this.versionRings = {};
  }

  if (specs.length) {
    ring = new hashring(specs.map(function (spec) { return spec.id }));
    if (version) {
      this.versionRings[version] = ring;
      return ring;
    }
    else {
      this.ring = ring;
    }
  }
  else {
    delete this.ring;
  }
};

Service.prototype.specFromRing = function (clientId, version) {
  var hashRing = version ? this.createRing(version) : this.ring;

  if (hashRing) {
    var specId = hashRing.getNode(clientId);
    for (var idx in this.specs) {
      if (this.specs[idx].id === specId) {
        return this.specs[idx];
      }
    }
  }
};

// Remove a spec from the service's pool.
Service.prototype.removeSpec = function (spec) {
  for (var idx in this.specs) {
    if (this.specs[idx].id === spec.id) {
      this.ring.removeServer(spec.id);
      this.specs.splice(idx, 1);
      return;
    }
  }
};

Service.prototype.specRequest = function () {
  var now = Date.now();
  if (!this.lastSpecRequest || now - this.lastSpecRequest > this.options.specRequestThrottle) {
    this.lastSpecRequest = now;
    amino.publish('_get:' + this.name, amino.id);
  }
};

// Entry point. ClientRequest will call this.
Service.prototype.addRequest = function (req, clientId) {
  req._clientId = clientId;

  if (this.spec.length) {
    if (!this.readyTimeout) {
      // Service is ready
      this.doRequest(req);
    }
    else {
      // Delay until the service is ready
      this.requests.push(req);
    }
  }
  else {
    // No available specs, queue the request and request specs.
    this.requests.push(req);
    this.specRequest();
  }
};

// Use a spec to complete the request.
Service.prototype.doRequest = function (req) {
  var self = this;

  process.nextTick(function () {
    var spec, version = reqVersion(req);
    if (req._clientId) {
      spec = self.specFromRing(req._clientId, version);
    }
    else if (version) {
      // Search for a spec to satisfy the request.
      for (var idx in self.specs) {
        if (self.specs[idx].version && semver.satisfies(self.specs[idx].version, version)) {
          spec = self.specs.splice(idx, 1)[0];
          break;
        }
      }
    }
    else {
      // Use the next available spec.
      spec = self.specs.shift();
    }

    if (!spec) {
      // Between ticks, the last spec must've been removed (or semver hasn't
      // been satisfied). Defer till more specs come in.
      self.specs.push(req);
      return;
    }

    if (!req._clientId) {
      // Push the spec back onto the queue.
      self.specs.push(spec);
    }

    // If an error occurs on the request, take it out of the spec pool.
    req.once('error', function(err) {
      // Remove spec immediately, and broadcast to other agents
      self.removeSpec(spec);
      amino.publish('_drop:' + spec.service, spec);
    });

    // Emit the spec for the request to use.
    req.emit('spec', spec);

    // Do next request if queued.
    self.nextRequest();
  });
};

// Do the next request in the queue.
Service.prototype.nextRequest = function () {
  if (this.requests.length) {
    this.doRequest(this.requests.shift());
  }
};

Service.prototype.reqVersion = function (req) {
  var headers = (req.headers || req._headers || {});
  for (var prop in headers) {
    if (prop.toLowerCase() === 'x-amino-version') {
      return headers[prop];
    }
  }
};