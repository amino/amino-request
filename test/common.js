amino = require('amino')
  .use(require('../'))
  .init({request: false});

http = require('http');

assert = require('assert');

net = require('net');

async = require('async');

createRequest = require('./helpers/createRequest');