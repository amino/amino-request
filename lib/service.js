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