describe('request', function () {
  var service;

  it('sets up a service', function (done) {
    var server = http.createServer(function (req, res) {
      switch (req.url) {
        case '/':
          assert.equal(req.method, 'GET'); break;
        case '/post':
          assert.equal(req.method, 'POST');
          req.pipe(res);
          return;
        case '/header':
          assert.equal(req.headers['x-test-header'], 'hey'); break;
        case '/version':
          assert.equal(req.headers['x-amino-version'], '~0.1.0'); break;
        default:
          assert.fail(req.url, '/');
      }

      res.end('cool stuff');
    });
    service = amino.createService('cool-stuff@0.1.0', server);
    service.once('listening', done);
  });

  it('can GET the service', function (done) {
    amino.request('cool-stuff', '/', assertRes.bind(null, 'cool stuff', done));
  });

  it('can stream both ways', function (done) {
    fs.createReadStream(stuffPath)
      .pipe(amino.request('cool-stuff', 'POST /post'))
      .pipe(new ValidationStream(stuff, done));
  });

  it('can post using body option', function (done) {
    amino.request('cool-stuff', 'POST /post', {body: stuff}, assertRes.bind(null, stuff, done));
  });

  it('can send a custom header', function (done) {
    amino.request('cool-stuff', '/header', {headers: {'X-Test-Header': 'hey'}}, assertRes.bind(null, 'cool stuff', done));
  });

  it('sends a version', function (done) {
    amino.request('cool-stuff@~0.1.0', '/version', assertRes.bind(null, 'cool stuff', done));
  });

  after(function (done) {
    amino.reset();
    service.once('close', done);
    service.close();
  });
});