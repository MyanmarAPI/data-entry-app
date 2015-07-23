
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
var db;
if (typeof global.it === 'function') {
  db = new sqlite3.Database('./test.sqlite3');
} else {
  db = new sqlite3.Database('./database.sqlite3');
}
var timeago = require("timeago");

var form_fields = ['house', 'serial', 'full_name', 'national_id', 'ward_village', 'voter_list_number', 'dob', 'nationality', 'religion', 'education', 'occupation', 'address_perm', 'address_mail', 'constituency_name', 'constituency_number', 'party'];

// authentication
var passport = require("passport");
var userAuth = require("./user-auth");
userAuth.setupAuth(passport, db);
var isLoggedIn = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/status');
};

// Zawgyi converter
// var knayi = require("knayi-myscript");

// numeric converter
var myanmarNumbers = require("myanmar-numbers").myanmarNumbers;

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
var renderForm = function(res, row, order, matching) {
  if ((typeof matching == 'undefined') || !matching) {
    matching = [];
  }

  // display form to user
  res.render('form', {
    form: {
      id: row.id,
      order: order,
      scan_file: '/form_images/' + row.scan_file
    },
    matching: matching
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

var respondForm = function(res, row, order, matching) {
  if ((typeof matching == 'undefined') || !matching) {
    matching = [];
  }

  // display form to user
  res.json({
    form: {
      id: row.id,
      order: order,
      scan_file: '/form_images/' + row.scan_file
    },
    matching: matching
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

var entries_done = function(entry1, entry2) {
  var matching = [];
  for (var i = 0; i < form_fields.length; i++) {
    // make integer fields into strings too, for a generic data cleaner
    entry1[form_fields[i]] += "";
    entry2[form_fields[i]] += "";

    if (entry1[form_fields[i]].replace(/\s/g, '') === entry2[form_fields[i]].replace(/\s/g, '')) {
      matching.push(form_fields[i]);
    } else {
      console.log( form_fields[i] + ": " + entry1[form_fields[i]] + " did not match " + entry2[form_fields[i]]);
    }
  }
  if (form_fields.length === matching.length) {
    return true;
  } else {
    return matching;
  }
};

var finishForm = function(thirdEntry) {
  // mark non-consensus data
  db.run('UPDATE forms SET entries_done = 1 WHERE form_id = ' + thirdEntry.form_id);
};

var findNextForm = function(req, res, format) {
  var endResponse = renderForm;
  var redirectResponse = function() {
    if (format === 'json') {
      res.redirect('/get-form?third=true');
    } else {
      res.redirect('/type-form?third=true')
    }
  };
  if (format === 'json') {
    endResponse = respondForm;
  }

  db.get('SELECT * FROM forms INNER JOIN entries on first_entry_id WHERE third_entry_id IS NULL AND first_entry_id > 0 AND second_entry_id > 0 AND NOT entries_done AND entries.user_id != ' + req.user.id, function(err, form_seeking_match) {
    if (err) {
      return res.json({ status: 'error', error: err });
      //throw err;
    }
    if (form_seeking_match && !req.query.third) {
      db.get('SELECT * FROM entries WHERE id = ' + form_seeking_match.second_entry_id, function(err, second_entry) {
        if (err) {
          return res.json({ status: 'error', error: err });
          //throw err;
        }
        var matching = entries_done(form_seeking_match, second_entry);
        if (matching === true) {
          // past entries match - update DB
          console.log('all matched');
          db.run('UPDATE forms SET entries_done = 1 WHERE id = ' + second_entry.form_id);
          db.run("UPDATE forms SET consensus_id = '" + second_entry.norm_national_id + "' WHERE id = " + second_entry.form_id);
          return redirectResponse();
        }
        if (second_entry.user_id === req.user.id * 1) {
          // current user already reviewed this form
          console.log('user cannot review');
          return redirectResponse();
        }
        second_entry.scan_file = form_seeking_match.scan_file;
        second_entry.id = second_entry.form_id;
        endResponse(res, second_entry, 3, matching);
      });
      return;
    }

    db.get('SELECT forms.id, scan_file FROM forms INNER JOIN entries ON first_entry_id WHERE second_entry_id IS NULL AND entries.user_id != ' + req.user.id, function(err, row) {
      if (err) {
        return res.json({ status: 'error', error: err });
        // throw err;
      }
      if (!row) {
        // no forms waiting for second validator
        db.get('SELECT id, scan_file FROM forms WHERE first_entry_id IS NULL LIMIT 1', function(err, row) {
          if (err) {
            return res.json({ status: 'error', error: err });
            // throw err;
          }
          if (!row) {
            return res.json({ status: 'done' });
            //res.send('No forms for you to digitize! (some may need a second validator)');
          } else {
            endResponse(res, row, 1);
          }
        });
      } else {
        endResponse(res, row, 2);
      }
    });
  });
};

app.get('/get-form', isLoggedIn, function(req, res) {
  findNextForm(req, res, 'json');
});

app.get('/type-form', isLoggedIn, function(req, res) {
  findNextForm(req, res, 'html');
});

app.post('/submit-form', isLoggedIn, function(req, res) {
  var form_values = [];
  form_values.push(req.user.id);
  form_values.push(req.body.form_id * 1);
  form_values.push(myanmarNumbers(req.body.national_id));
  req.body.constituency_number = myanmarNumbers(req.body.constituency_number || '0');
  req.body.serial = myanmarNumbers(req.body.serial || '0');

  for (var k in form_fields) {
    form_values.push(req.body[form_fields[k]]);
  }
  form_values = "'" + form_values.join("','") + "'";
  db.run('INSERT INTO entries (user_id, form_id, norm_national_id, ' + form_fields.join(',') + ') VALUES (' + form_values + ')', function(err) {
    if (err) {
      return res.json({ status: 'error', error: err });
      // throw err;
    }
    // record the entry
    var entry_id = this.lastID;
    var order = req.body.order * 1;
    var entry_column = "first_entry_id";
    if (order === 2) {
      entry_column = "second_entry_id";
    } else if (order === 3) {
      entry_column = "third_entry_id";
      finishForm(req.body);
    }
    db.get('UPDATE forms SET ' + entry_column + ' = ' + entry_id + ' WHERE id = ' + req.body.form_id, function(err, row) {
      if (err) {
        return res.json({ status: 'error', error: err });
        // throw err;
      }
      res.json({ status: 'ok', entry: entry_id });
    });
  });
});

// review entries
app.get("/admin", function(req, res) {
  db.get("SELECT COUNT(*) AS total FROM forms", function(err, r1) {
    db.get("SELECT COUNT(*) AS finished FROM forms WHERE entries_done", function(err, r2) {
      res.render('admin', {
        total: r1.total,
        finished: r2.finished
      });
    });
  });
});

var fixDates = function(rows) {
  for (var i = 0; i < rows.length; i++) {
    rows[i].saved = timeago(new Date(rows[i].saved + " UTC"));
  }
  return rows;
};

app.get('/candidate/:national_id', function(req, res) {
  var norm_number = myanmarNumbers(req.params.national_id);
  db.all("SELECT id, full_name, saved FROM entries WHERE norm_national_id = '" + norm_number + "' ORDER BY saved DESC", function(err, rows) {
    if (err) {
      throw err;
    }
    if (!rows.length) {
      // try with serial number
      db.all("SELECT id, full_name, saved FROM entries WHERE serial = '" + norm_number + "' ORDER BY saved DESC", function(err, rows) {
        if (err) {
          throw err;
        }
        rows = fixDates(rows);
        res.render('entries', {
          entries: rows
        });
      });
    } else {
      rows = fixDates(rows);
      res.render('entries', {
        entries: rows
      });
    }
  });
});

app.get('/entries', function(req, res) {
  db.all('SELECT id, full_name, saved FROM entries ORDER BY saved DESC LIMIT 20', function(err, rows) {
    if (err) {
      throw err;
    }
    rows = fixDates(rows);
    res.render('entries', {
      entries: rows
    });
  });
});

app.get('/entries/:username', function(req, res) {
  db.get('SELECT * FROM users WHERE username = ?', req.params.username, function(err, user) {
    db.all('SELECT id, full_name, saved FROM entries WHERE user_id = ' + user.id + ' ORDER BY saved DESC LIMIT 20', function(err, rows) {
      if (err) {
        throw err;
      }
      rows = fixDates(rows);
      res.render('entries', {
        entries: rows
      });
    });
  });
});

app.get('/entry/:id', function(req, res) {
  db.get('SELECT * FROM entries INNER JOIN forms ON form_id WHERE entries.id = ' + req.params.id, function(err, row) {
    if (err) {
      throw err;
    }
    res.render('entry', {
      entry: row
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
