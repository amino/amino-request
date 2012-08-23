describe('sticky session', function () {
  var services;

  it('sets up 3 servers', function (done) {
    var tasks = [];
    // Set up 3 services to test load balancing/failover
    for (var i = 0; i < 3; i++) {
      tasks.push(function (cb) {
        var server = net.createServer(function (socket) {
          socket.on('data', function (data) {
            socket.end(data.toString() + ':' + service.spec.id + ':1');
          });
        });
        var service = amino.createService('test@1.1.0', server);
        service.on('listening', function () {
          cb(null, service);
        });
      });
    }
    async.parallel(tasks, function(err, results) {
      services = results;
      done();
    });
  });

  it('sticks to one server', function (done) {
    // Send 6 requests, which should all go to the same server.
    var tasks = []
      , clientId = amino.utils.idgen()
      , specId

    for (var i = 0; i < 6; i++) {
      tasks.push(function (cb) {
        var req = createRequest({service: 'test@1.1.x', stickyId: clientId});
        req.on('connect', function () {
          if (typeof specId === 'string') {
            assert.strictEqual(req.spec.id, specId);
          }
          else if (typeof specId === 'undefined') {
            specId = req.spec.id;
          }
          else {
            assert.fail(specId, undefined);
          }
        });
      });
    }
    async.parallel(tasks, function (err, results) {
      assert.ifError(err);
      done();
    });
  });

  it('closes the services', function (done) {
    amino.reset();
    var tasks = services.map(function (service) { return service.close.bind(service); });
    async.parallel(tasks, done);
  });
});