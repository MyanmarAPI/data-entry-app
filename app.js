
// basic HTTP
var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
var flash = require("connect-flash");
var compression = require("compression");

// database for users and forms
var fs = require("fs");
var sqlite3 = require("sqlite3");
var db = new sqlite3.Database('./database.sqlite3');

// authentication
var passport = require("passport");
var userAuth = require("./user-auth");
userAuth.setupAuth(passport, db);
var isLoggedIn = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Zawgyi converter
// var knayi = require("knayi-myscript");

// set up server
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express['static'](__dirname + '/app'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(compression());
app.use(cookieParser());
app.use(session({ secret: process.env.SECRET || 'fliweflejfio2j2p9jf3' }));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// server status
var serverStatus = require('./server-status');
app.get('/status', serverStatus.status);

// type form sections
var renderForm = function(res, row, order) {
  // display form to user
  res.render('form', {
    form: {
      id: row.id,
      order: order,
      scan_file: '/form_images/' + row.scan_file
    }
  });

  // mark form as actively worked-on
  if (order === 1) {
    db.get("UPDATE forms SET first_entry_id = -1 WHERE scan_file != '000000-test.png' AND id = " + row.id);
  } else if (order === 2) {
    db.get("UPDATE forms SET second_entry_id = -1 WHERE scan_file != '000000-test.png' AND id = " + row.id);
  } else if (order === 3) {
    db.get("UPDATE forms SET third_entry_id = -1 WHERE scan_file != '000000-test.png' AND id = " + row.id);
  }
};

app.get('/type-form', isLoggedIn, function(req, res) {
  db.get('SELECT forms.id, scan_file FROM forms INNER JOIN users ON first_entry_id WHERE second_entry_id IS NULL AND users.id != ' + req.user.id, function(err, row) {
    if (err) {
      throw err;
    }
    if (!row) {
      // no forms waiting for second validator
      db.get('SELECT id, scan_file FROM forms WHERE first_entry_id IS NULL LIMIT 1', function(err, row) {
        if (err) {
          throw err;
        }
        if (!row) {
          res.send('No forms for you to digitize! (some may need a second validator)');
        } else {
          renderForm(res, row, 1);
        }
      });
    } else {
      renderForm(res, row, 2);
    }
  });
});

app.post('/type-form', isLoggedIn, function(req, res) {
  var form_values = [];
  form_values.push(req.user.id);
  var form_keys = ['full_name', 'national_id', 'ward_village', 'dob', 'education', 'occupation', 'address_perm', 'address_mail', 'constituency', 'party', 'father', 'father_origin', 'mother', 'mother_origin'];
  for (var k in form_keys) {
    form_values.push(req.body[form_keys[k]]);
  }
  form_values = "'" + form_values.join("','") + "'";
  db.run('INSERT INTO entries (user_id, ' + form_keys.join(',') + ') VALUES (' + form_values + ')', function(err) {
    if (err) {
      throw err;
    }
    // record the entry
    var order = req.body.order * 1;
    var entry_column = "first_entry_id";
    if (order === 2) {
      entry_column = "second_entry_id";
    } else if (order === 3) {
      entry_column = "third_entry_id";
    }
    db.get('UPDATE forms SET ' + entry_column + ' = ' + this.lastID + ' WHERE id = ' + req.body.form_id, function(err, row) {
      res.redirect('/type-form');
    });
  });
});

// data maintenance
app.get('/data-update', function(req, res) {
  // find any new scan images and include them in the forms table
  var files = fs.readdir(__dirname + "/app/form_images", function(err, files) {
    if (err) {
      throw err;
    }
    var createForm = function(fname) {
      db.get('SELECT id FROM forms WHERE scan_file = ?', fname, function(err, row) {
        if (!row) {
          db.get("INSERT INTO forms (scan_file, approved) VALUES ('" + fname + "', 0)", function(err) {
            console.log('added form with scan file');
          });
        }
      });
    };
    for (var i in files){
      createForm(files[i]);
    }
    res.send('updating database');
  });
});

app.get('/activate-form', function(req, res) {
  // find any open forms and allow new editors to edit them
  db.get('UPDATE forms SET first_entry_id = NULL WHERE first_entry_id = -1; UPDATE forms SET second_entry_id = NULL WHERE second_entry_id = -1; UPDATE forms SET third_entry_id = NULL WHERE third_entry_id = -1', function(err, row) {
    if (err) {
      throw err;
    }
    res.send('cleared forms');
  });
});

// user authentication sections
app.get('/register', function(req, res) {
  res.render('register');
});

app.post('/register', function(req, res) {
  userAuth.createUser(req, db, function() {
    res.redirect('/login?state=newuser');
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', passport.authenticate('local-login', {
  successRedirect: '/type-form',
  failureRedirect: '/login?state=failed'
}));

// launch the server process
var server = app.listen(process.env.PORT || 3000, function() {
  var port = server.address().port;
  console.log('Serving on http://localhost:' + port);
});

module.exports = app;