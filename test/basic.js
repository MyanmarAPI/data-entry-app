var assert = require('chai').assert;
var request = require('supertest');
var sqlite3 = require('sqlite3');

var app = require('../app');
var db = new sqlite3.Database('./test.sqlite3');
var form = require('../app/form.json');
var ignore_fields = ["age"];

var form_id;

describe('GET /', function() {
  it('returns homepage', function(done) {
    request(app)
      .get('/')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        assert.include(res.text, 'Polymer Starter Kit');
        done();
      });
  });
});

it('rejects /get-form while logged out', function(done) {
  request(app)
    .get('/get-form')
    .expect(200)
    .end(function(err, res) {
      if (err) {
        return done(err);
      }
      var jrep = JSON.parse(res.text);
      assert.equal(jrep.status, 'error');
      done();
    });
});

describe('Registration, login, first entry', function() {
  var agent = request.agent(app);

  it('registers first user', function(done) {
    agent.post('/register')
      .send({
        email: 'test',
        password: 'test'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('rejects bad login', function(done) {
    agent.post('/login')
      .send({
        email: 'test',
        password: 'fail'
      })
      .expect(401)
      .end(done);
  });

  it('logs in first user', function(done) {
    agent.post('/login')
      .send({
        email: 'test',
        password: 'test'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('has a good /status while logged in', function(done) {
    agent.get('/status')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status.server, 'ok');
        assert.equal(jrep.status.user, 'ok');
        done();
      });
  });

  it('has status: done when there are no forms', function(done) {
    agent.get('/get-form')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'done');
        done();
      });
  });

  it('adds a form from the test image', function(done) {
    agent.get('/data-update')
      .expect(200)
      .end(function(err, res) {
        return done(err);
      });
  });

  it('receives the new test image from /get-form', function(done) {
    agent.get('/get-form')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        form_id = jrep.form.id;
        assert.include(jrep.form.scan_file, '/fax_images/');
        assert.equal(jrep.form.order, 1);
        assert.equal(jrep.matching.length, 0);
        done();
      });
  });

  it('gets a success response from posting the form', function(done) {
    agent.post('/submit-form')
      .send({
        form_id: form_id,
        full_name: 'dude',
        order: 1,
        national_id: '101'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        assert.equal(typeof jrep.entry, 'number');
        done();
      });
  });

  it('gets status: done after the user has an entry on the only form', function(done) {
    agent.get('/get-form')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'done');
        done();
      });
  });
});

describe('Second entry offered to second user', function() {
  var agent = request.agent(app);

  it('registers second user', function(done) {
    agent.post('/register')
      .send({
        email: 'test2',
        password: 'test2'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('logs in second user', function(done) {
    agent.post('/login')
      .send({
        email: 'test2',
        password: 'test2'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('receives the test image from /get-form', function(done) {
    agent.get('/get-form')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.form.id, form_id);
        assert.include(jrep.form.scan_file, '/fax_images/');
        assert.equal(jrep.form.order, 2);
        assert.equal(jrep.matching.length, 0);
        done();
      });
  });

  it('gets a success response from posting the form', function(done) {
    agent.post('/submit-form')
      .send({
        form_id: form_id,
        full_name: 'dude',
        order: 2,
        national_id: '102'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('gets redirect (ultimately to status: done) after the user has an entry on the only form', function(done) {
    agent.get('/get-form')
      .expect(302)
      .expect('Location', '/get-form?third=true', done);
  });
});

describe('Issue-solving entry offered to third user', function() {
  var agent = request.agent(app);

  it('registers third user', function(done) {
    agent.post('/register')
      .send({
        email: 'test3',
        password: 'test3'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('logs in third user', function(done) {
    agent.post('/login')
      .send({
        email: 'test3',
        password: 'test3'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('receives the test image and matching fields array from /get-form', function(done) {
    agent.get('/get-form')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.form.id, form_id);
        assert.include(jrep.form.scan_file, '/fax_images/');
        assert.equal(jrep.form.order, 3);
        assert.equal(jrep.matching.indexOf("full_name") > -1, true);
        assert.equal(jrep.matching.indexOf("national_id"), -1);
        done();
      });
  });
});

describe('cleanup', function() {
  it('cleans up test database', function(done) {
    db.run('DELETE FROM forms', function(err) {
      if (err) {
        return done(err);
      }
      db.run('DELETE FROM entries', function(err) {
        if (err) {
          return done(err);
        }
        db.run('DELETE FROM users', function(err) {
          return done(err);
        });
      });
    });
  });
});

describe('data entry without form', function() {
  var agent = request.agent(app);

  it('registers user', function(done) {
    agent.post('/register')
      .send({
        email: 'test',
        password: 'test'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('logs in user', function(done) {
    agent.post('/login')
      .send({
        email: 'test',
        password: 'test'
      })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        done();
      });
  });

  it('posts entry without form_id', function(done) {
    var form_fields = { order: 1 };
    for (var f = 0; f < form.length; f++) {
      form_fields[form[f].field] = f + "";
    }
    agent.post('/submit-form')
      .send(form_fields)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        var jrep = JSON.parse(res.text);
        assert.equal(jrep.status, 'ok');
        entry_id = jrep.entry;
        done();
      });
  });

  it('remembers all form field values', function(done) {
    agent.get('/entry/' + entry_id)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }
        for (var f = 0; f < form.length; f++) {
          if (ignore_fields.indexOf(form[f].field) === -1) {
            assert.include(res.text, form[f].field);
            assert.include(res.text, 'value="' + f + '"');
          }
        }
        done();
      });
  });
});

describe('cleanup2', function() {
  it('cleans up test database', function(done) {
    db.run('DELETE FROM forms', function(err) {
      if (err) {
        return done(err);
      }
      db.run('DELETE FROM entries', function(err) {
        if (err) {
          return done(err);
        }
        db.run('DELETE FROM users', function(err) {
          return done(err);
        });
      });
    });
  });
});
