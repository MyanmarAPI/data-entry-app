
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
var csv = require("fast-csv");

var nat_id_sql =
"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(norm_national_id, 'နိုင်', 'XOX'), 'နို်င', 'XOX'), ' ', ''), '-', ''), '.', ''), '/', ''), '့်', '့်'),'(', ''), ')', ''), '−', ''), '၊', ''), 'ပဘ', 'သဘ')";
var full_name_sql =
"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(full_name, 'နိုင်', 'XOX'), 'နို်င', 'XOX'), ' ', ''), '-', ''), '.', ''), '/', ''), '့်', '့်'),'(', ''), ')', ''), '−', ''), '၊', ''), 'ပဘ', 'သဘ')";

var normalizeNatId = function(natid) {
  natid = (natid + "").replace(/နိုင်/g, 'XOX');
  natid = natid.replace(/နို်င/g, 'XOX');
  natid = natid.replace(/\-/g, '');
  natid = natid.replace(/\−/g, '');
  natid = natid.replace(/\./g, '');
  natid = natid.replace(/\//g, '');
  natid = natid.replace(/့်/g, '့်');
  natid = natid.replace(/\(/g, '');
  natid = natid.replace(/\)/g, '');
  natid = natid.replace(/\s/g, '');
  natid = natid.replace(/၊/g, '');
  natid = natid.replace(/ပဘ/g, 'သဘ');
  return natid;
};

var form_fields = ['house', 'serial', 'full_name', 'national_id', 'ward_village', 'voter_list_number', 'dob', 'nationality', 'religion', 'education', 'occupation', 'address_perm', 'address_mail', 'constituency_name', 'constituency_number', 'party', 'mother', 'mother_id', 'father', 'father_id', 'mother_ethnicity', 'father_ethnicity', 'mother_religion', 'father_religion'];

// authentication
var passport = require("passport");
var userAuth = require("./user-auth");
userAuth.setupAuth(passport, db);
var isLoggedIn = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.json({status:'error',error:'not authenticate'});
  return false;
};

// Zawgyi converter
// var knayi = require("knayi-myscript");

// numeric converter
var myanmarNumbers = require("myanmar-numbers").myanmarNumbers;

// set up server
var app = express();

//serve static files from app and bowers directory
app.use(express.static('app'));
app.use('/bower_components',express.static('bower_components'));

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

// name output
app.get('/names', function (req, res) {
  db.all('SELECT full_name, national_id FROM consensus_forms', function(err, rows) {
    rows = rows.map(function(row) {
      return row.full_name + " (" + row.national_id + ")";
    });
    res.render('names', {
      namelist: rows
    });
  });
});

// error fixer - data should be relatively complete
app.get('/form/:id', function (req, res) {
  db.get('SELECT scan_file FROM forms WHERE id = ?', req.params.id, function (err, form) {
    res.redirect(form.scan_file);
  });
});

app.get('/errors', isLoggedIn, function (req, res) {
  db.all('SELECT * FROM entries WHERE finalized = 1 AND form_id > 0 ORDER BY saved DESC LIMIT 60 OFFSET 40', function(err, rows) {
    if (err) {
      return res.json(err);
    }
    var final_entry = rows[Math.floor(Math.random() * 80)];

    if (!final_entry.norm_national_id.match(/\d\d/)) {
      // not a valid ID
      return res.redirect('/errors');
    }

    var norm_id = normalizeNatId(final_entry.norm_national_id);

    db.all('SELECT * FROM consensus_forms WHERE ' + nat_id_sql + ' = ?', norm_id, function(err, matches) {
      if (err) {
        return res.json(err);
      }
      if (!matches.length) {
        return res.redirect('/errors');
      }

      res.render('errorcheck', {
        matches: [final_entry].concat(matches)
      });
    });
  });
});

app.post('/errors/:entry_id/:entry2_id', isLoggedIn, function (req, res) {
  db.get('SELECT * FROM entries WHERE id = ?', req.params.entry_id, function (err, row) {
    if (err) {
      return res.send('error posting');
    }
    if (!row) {
      return res.json({});
    }

    var fields = ['user_id', 'unknowns'];
    var vals = [req.user.id, (req.body.unknowns || []).join(",")];

    for (var r in row) {
      if (['id', 'saved', 'user_id', 'mother_name', 'finalized'].indexOf(r) === -1) {
        fields.push(r);
        vals.push(row[r]);
      }
    }

    // modify initial entry to match what the user said
    var set_fields = (req.body.set_fields || []);
    for (var i = 0; i < set_fields.length; i++) {
      var set_key = set_fields[i].key;
      var set_val = set_fields[i].selection;
      vals[ fields.indexOf(set_key) ] = set_val;
    }

    //console.log("INSERT INTO consensus_forms (" + fields.join(',') + ") VALUES ('" + vals.join("','") + "')");

    db.run("INSERT INTO consensus_forms (" + fields.join(',') + ") VALUES ('" + vals.join("','") + "')", function(err) {
      if (err) {
        return res.send('error inserting into consensus forms');
      }

      db.run('UPDATE entries SET finalized = 1 WHERE id = ?', req.params.entry_id);
      db.run('UPDATE entries SET finalized = 1 WHERE id = ?', req.params.entry2_id);

      return res.json({});
    });
  });
});

app.post('/errors/:final_entry_id/:consensus_form_id/:form_id', isLoggedIn, function (req, res) {
  var norm_id = normalizeNatId(req.body.norm_national_id);
  db.run('UPDATE entries SET finalized = 3 WHERE ' + nat_id_sql + ' = ?', norm_id, function (err) {
    if (err) {
      return res.json(err);
    }

    var update_statements = ['form_id = ' + req.params.form_id * 1];

    var set_fields = (req.body.set_fields || []);
    var updated_fields = [];
    for (var i = set_fields.length - 1; i >= 0; i--) {
      var set_key = set_fields[i].key;
      if (updated_fields.indexOf(set_key) === -1) {
        var set_val = set_fields[i].selection;
        updated_fields.push(set_key);
        update_statements.push(set_key + " = '" + set_val + "'");
      }
    }

    // console.log('UPDATE consensus_forms SET ' + update_statements.join(',') + ' WHERE id = ?');
    db.run('UPDATE consensus_forms SET ' + update_statements.join(',') + ' WHERE id = ?', req.params.consensus_form_id, function (err) {
      if (err) {
        return res.json(err);
      }
      return res.redirect('/errors');
    });
  });
});

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
      scan_file: row.scan_file
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
      scan_file: row.scan_file
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

    if (entry1[form_fields[i]].length && entry1[form_fields[i]].replace(/\s/g, '') === entry2[form_fields[i]].replace(/\s/g, '')) {
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
  var ts = Math.round((new Date()).getTime() / 1000);
  var range=ts-(5*60);
  var endResponse = renderForm;

  if (format === 'json') {
    endResponse = respondForm;
  }

  if (req.headers.referer.indexOf("fax") > -1) {
    return res.json({ status: 'done' });
  }

  db.get('SELECT f.* FROM forms f LEFT JOIN entries e on f.id=e.form_id WHERE  e.id IS NULL AND NOT f.second_page AND (first_entry_id IS NULL AND second_entry_id IS NULL AND third_entry_id IS NULL) AND (f.last_loaded IS NULL OR f.last_loaded<?)', range, function(err, row) {
    if (err) {
      console.log(err);
      return res.json({ status: 'error', error: err });
    }
    if(typeof row!=='undefined'){
      console.log('updating form:'+row.id);
      db.run('UPDATE forms SET last_loaded = '+ts+' WHERE id = ?', row.id);
    }

    endResponse(res, row, 3);

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
  var norm_national_id = myanmarNumbers(req.body.national_id);
  form_values.push(norm_national_id);
  req.body.constituency_number = myanmarNumbers(req.body.constituency_number || '0');
  req.body.serial = myanmarNumbers(req.body.serial || '0');

  for (var k in form_fields) {
    form_values.push(req.body[form_fields[k]]);
  }

  var saveEntry = function(entry_id) {
    var order = req.body.order * 1;
    var entry_column = "first_entry_id";
    if (order === 2) {
      entry_column = "second_entry_id";
    } else if (order === 3) {
      entry_column = "third_entry_id";
      finishForm(req.body);
    }
    var respondSubmit = function() {
      if (req.query.format === 'html') {
        res.redirect('/type-form');
      } else {
        res.json({ status: 'ok', entry: entry_id });
      }
    };
    if (req.body.form_id) {
      norm_national_id = normalizeNatId(norm_national_id + "");
      db.all("SELECT id FROM entries WHERE " + nat_id_sql + " = ?", norm_national_id, function(err, rows) {
        if (err) {
          return res.json({ status: 'error', error: err });
        }
        if (req.body.second_page && req.body.second_page != "0") {
          var scan_url = "/color_images" + unescape(req.body.second_page.split("color_images")[1]);
          db.get('UPDATE forms SET second_page = 1 WHERE scan_file = ?', scan_url);
        }
        if (rows.length > 1) {
          db.get('UPDATE forms SET first_entry_id = ' + entry_id + ', entries_done = 1 WHERE id = ' + req.body.form_id, function(err, row) {
            if (err) {
              return res.json({ status: 'error', error: err });
            }
            db.get("UPDATE entries SET finalized = 1 WHERE " + nat_id_sql + " = ?", norm_national_id, function(err) {
              if (err) {
                return res.json({ status: 'error', error: err });
              }
              respondSubmit();
            });
          });
        } else {
          db.get('UPDATE forms SET ' + entry_column + ' = ' + entry_id + ' WHERE id = ' + req.body.form_id, function(err, row) {
            if (err) {
              return res.json({ status: 'error', error: err });
            }
            respondSubmit();
          });
        }
      });
    } else {
      respondSubmit();
    }
  };

  // saving a new form
  form_values = "'" + form_values.join("','") + "'";
  console.log('recording new entry');

  db.run('INSERT INTO entries (user_id, form_id, norm_national_id, ' + form_fields.join(',') + ') VALUES (' + form_values + ')', function(err) {
    if (err) {
      console.log(err);
      return res.json({ status: 'error', error: err });
    }

    // record the entry
    var entry_id = this.lastID;
    saveEntry(entry_id);
  });
});

// review entries
app.get("/admin", function(req, res) {
  db.get("SELECT COUNT(*) AS total FROM entries", function(err, r1) {
    db.get("SELECT COUNT(*) AS total FROM consensus_forms", function(err, r2) {
      db.get("SELECT COUNT(DISTINCT(form_id)) AS total FROM entries", function(err, r3) {
        db.get("SELECT COUNT(*) AS total FROM consensus_forms WHERE form_id > 0", function(err, r4) {
          res.render('admin', {
            entries: r1.total,
            consensus_forms: r2.total,
            scanned_candidates: r3.total,
            consensus_forms_with_scans: r4.total
          });
        });
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

app.get('/candidate', function(req, res) {
  res.redirect('/candidate/' + req.query.serial);
});

app.get('/suggestcandidate/:national_id', function(req, res) {
  var norm_number = normalizeNatId(myanmarNumbers(req.params.national_id))

  var respondCandidates = function(rows) {
      var list=[];
      rows.forEach(function(row){
          list.push(row.national_id);
      });
      res.json({ status: 'ok', data: list });
  };

  db.all("SELECT national_id FROM consensus_forms WHERE " + nat_id_sql + " LIKE '" + norm_number + "%' ORDER BY saved DESC", function(err, rows) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    if (!rows.length) {
      db.all("SELECT national_id FROM entries WHERE " + nat_id_sql + " LIKE '" + norm_number + "%' ORDER BY saved DESC", function(err, rows) {
        if (err) {
          return res.json({ status: 'error', error: err });
        }
        respondCandidates(rows);
      });
    } else {
      // candidates match national id
      respondCandidates(rows);
    }
  });
});

app.get('/candidate/:national_id', function(req, res) {
  var national_id = req.params.national_id.replace('*','/');
  var norm_number = normalizeNatId(myanmarNumbers(national_id));

  var respondCandidates = function(rows) {
    if (req.query.format === 'json') {
      res.json(rows);
    } else {
      rows = fixDates(rows);
      res.render('entries', {
        entries: rows
      });
    }
  };

  db.all("SELECT *, 'consensus_form' AS source FROM consensus_forms WHERE " + nat_id_sql + " LIKE '" + norm_number + "%' ORDER BY saved DESC LIMIT 0,20", function(err, rows) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    if (!rows.length) {
      db.all("SELECT *, 'entry' AS source FROM entries WHERE " + nat_id_sql + " LIKE '" + norm_number + "%' ORDER BY saved DESC LIMIT 0,20", function(err, rows) {
        if (err) {
          return res.json({ status: 'error', error: err });
        }
        respondCandidates(rows);
      });
    } else {
      // candidates match national id
      respondCandidates(rows);
    }
  });
});

app.get('/entries', function(req, res) {
  db.all('SELECT id, full_name, saved FROM entries ORDER BY saved DESC LIMIT 20', function(err, rows) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    rows = fixDates(rows);
    res.render('entries', {
      entries: rows
    });
  });
});

app.get('/entries.json', function(req, res) {
  db.all('SELECT * FROM entries ORDER BY saved', function(err, rows) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    res.json(rows);
  });
});

app.get('/entries.csv', function(req, res) {
  db.all('SELECT * FROM entries ORDER BY saved', function(err, rows) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    csv.writeToString(rows, { headers: true }, function(err, data){
      if (err) {
        return res.json({ status: 'error', error: err });
      }
      res.send(data);
      res.end();
    });
  });
});

app.get('/entries/:username', function(req, res) {
  db.get('SELECT * FROM users WHERE username = ?', req.params.username, function(err, user) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    if (!user) {
      return res.json({ status: 'done', error: 'no user with that username' });
    }
    db.all('SELECT id, full_name, saved FROM entries WHERE user_id = ' + user.id + ' ORDER BY saved DESC LIMIT 20', function(err, rows) {
      if (err) {
        return res.json({ status: 'error', error: err });
      }
      rows = fixDates(rows);
      res.render('entries', {
        entries: rows
      });
    });
  });
});

app.get('/entry/:id', function(req, res) {
  db.get('SELECT * FROM entries WHERE id = ?', req.params.id, function(err, row) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    res.render('entry', {
      entry: row
    });
  });
});

app.get('/consensus_form/:id', function(req, res) {
  db.get('SELECT * FROM consensus_forms WHERE id = ?', req.params.id, function(err, row) {
    if (err) {
      return res.json({ status: 'error', error: err });
    }
    res.render('entry', {
      entry: row
    });
  });
});

// data update and maintenance
var scanImgDirectory = function(img_directory, color) {
  if (img_directory.indexOf("fax_images") > -1) {
    color = "bw";
  } else if (img_directory.indexOf("color_images") > -1) {
    color = "color";
  } else if (!color || color !== "bw" || color !== "color") {
    color = "bw";
  }
  var files = fs.readdir(__dirname + "/app/" + img_directory, function(err, files) {
    if (err) {
      return console.log(err);
    }
    var createForm = function(fname) {
      db.get('SELECT id FROM forms WHERE scan_file = ?', fname, function(err, row) {
        if (err) {
          return console.log(err);
        }
        if (!row) {
          if (color === "color") {
            if (fname.indexOf("000000-test") > -1 || fname.indexOf("DS_Store") > -1) {
              return;
            }
            db.get("INSERT INTO forms (scan_file, color_scan, approved) VALUES ('" + fname + "', '" + fname + "', 0)");
          } else {
            db.get("INSERT INTO forms (scan_file, approved) VALUES ('" + fname + "', 0)");
          }
        }
      });
    };
    for (var i in files){
      console.log('add image'+files[i]);
      createForm('/' + img_directory + '/' + files[i]);
    }
  });
};

app.get('/data-update', function(req, res) {
  // find any new scan images and include them in the forms table
  if (req.query.dir && req.query.color) {
    scanImgDirectory(req.query.dir, req.query.color);
  } else {
    scanImgDirectory("fax_images");
    scanImgDirectory("color_images");
  }
  res.send('processing new images');
});

var upper = require("./data/upper_house.json");
var lower = require("./data/lower_house.json");

app.get('/verify', isLoggedIn, function(req, res) {
  var constituency = req.query.constituency;
  var constituency_number = myanmarNumbers(req.query.constituency_number + '');

  if (!constituency) {
    return res.render('verify');
  } else {
    constituency = '%' + constituency + '%';
  }

  if (constituency_number && constituency_number * 1) {
    db.all("SELECT id, full_name, party, address_perm AS address, national_id, norm_national_id, verified, house, form_id, 'consensus_form' AS source FROM consensus_forms WHERE constituency_name LIKE ? AND (constituency_number = ? OR constituency_number = 0) UNION SELECT id, full_name, party, address_perm AS address, national_id, norm_national_id, verified, house, '0' AS form_id, 'entry' AS source FROM entries WHERE constituency_name LIKE ? AND (constituency_number = ? OR constituency_number = 0) ORDER BY source, form_id DESC, id DESC LIMIT 200", [constituency, constituency_number, constituency, constituency_number], function (err, candidates) {
      if (err) {
        throw err;
        return res.send(err);
      }
      if (candidates.length === 200) {
        return res.send('over 200 candidates');
      }
      res.render('verify', {
        house: req.query.house,
        candidates: candidates,
        constituency: constituency.substring(0, constituency.length - 1),
        constituency_number: constituency_number
      });
    });
  } else {
    db.all("SELECT id, full_name, party, address_perm AS address, national_id, norm_national_id, house, verified, form_id, 'consensus_form' AS source FROM consensus_forms WHERE constituency_name LIKE ? UNION SELECT id, full_name, party, address_perm AS address, national_id, norm_national_id, verified, house, '0' AS form_id, 'entry' AS source FROM entries WHERE constituency_name LIKE ? ORDER BY source, form_id DESC, id DESC LIMIT 200", [constituency, constituency], function (err, candidates) {
      if (err) {
        throw err;
        return res.send(err);
      }
      if (candidates.length === 200) {
        return res.send('over 200 candidates');
      }
      res.render('verify', {
        house: req.query.house,
        candidates: candidates,
        constituency: constituency.substring(0, constituency.length - 1),
        constituency_number: constituency_number
      });
    });
  }
});

app.post('/verified', isLoggedIn, function(req, res) {
  var verified = (req.body.verified || []).map(normalizeNatId).map(function(id) {
    return "'" + id + "'";
  });
  var unverified = (req.body.unverified || []).map(normalizeNatId).map(function(id) {
    return "'" + id + "'";
  });
  db.run('UPDATE consensus_forms SET verified = 1 WHERE ' + nat_id_sql + ' IN (' + verified.join(',') + ')', function (err) {
    if (err) {
      return res.json({ err: err });
    }
    db.run('UPDATE entries SET verified = 1 WHERE ' + nat_id_sql + ' IN (' + verified.join(',') + ')', function (err) {
      if (err) {
        return res.json({ err: err });
      }
      db.run('UPDATE consensus_forms SET verified = 0 WHERE ' + nat_id_sql + ' IN (' + unverified.join(',') + ')', function (err) {
        if (err) {
          return res.json({ err: err });
        }
        db.run('UPDATE entries SET verified = 0 WHERE ' + nat_id_sql + ' IN (' + unverified.join(',') + ')', function (err) {
          if (err) {
            return res.json({ err: err });
          }
          res.json({ success: "success" });
          for (var house in req.body.houses) {
            var houseids = req.body.houses[house].map(normalizeNatId).map(function(id) {
              return "'" + id + "'";
            });
            if (houseids.length) {
              db.run('UPDATE entries SET house = ? WHERE ' + nat_id_sql + ' IN (' + houseids.join(',') + ')', house);
              db.run('UPDATE consensus_forms SET house = ? WHERE ' + nat_id_sql + ' IN (' + houseids.join(',') + ')', house);
            }
          }
        });
      });
    });
  });
});

app.get('/house/:house', function(req, res) {
  var constituencies;
  var processCandidates = function(err, rows) {
    if (err) {
      return res.send('error: ' + err);
    }
    res.render('constituencies', {
      candidates: rows,
      constituencies: constituencies,
      house: req.params.house
    });
  };
  if (req.params.house === "lower") {
    constituencies = lower;
    db.all("SELECT full_name, national_id, constituency_name, constituency_number FROM consensus_forms WHERE TRIM(house) = 'ပြည်သူ့လွှတ်တော်' OR TRIM(house) = 'lower' OR TRIM(house) = 'တစ်ဦးချင်း' or constituency_number = 0 ORDER BY constituency_name", processCandidates);
  }
  if (req.params.house === "upper") {
    constituencies = upper;
    db.all("SELECT full_name, national_id, constituency_name, constituency_number FROM consensus_forms WHERE TRIM(house) = 'အမျိုးသားလွှတ်တော်' OR TRIM(house) = 'upper' OR TRIM(house) = 'ပါတီ' or constituency_number > 2 ORDER BY constituency_name, constituency_number", processCandidates);
  }
  if (req.params.house === "state") {
    db.all("SELECT full_name, national_id, constituency_name, constituency_number FROM consensus_forms WHERE TRIM(house) = 'တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်' OR TRIM(house) = 'state' OR TRIM(house) = 'တိုင်းရင်းသား' ORDER BY constituency_name, constituency_number", processCandidates);
  }
});

// user authentication sections

app.post('/register', function(req, res) {
  userAuth.createUser(req, db, function() {
    res.json({status:'ok'});
  });
});


app.post('/login', passport.authenticate('local-login', { session: true }), function(req, res) {
  if (!req.user)
    res.json({status:'error',error:info.error});
  else
    res.json({status:'ok',user:req.user});

});

// launch the server process
var server = app.listen(process.env.PORT || 8080, function() {
  var port = server.address().port;
  console.log('Serving on http://localhost:' + port);
});

module.exports = app;
