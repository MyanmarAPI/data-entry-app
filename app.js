
// basic HTTP
var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
var flash = require("connect-flash");
var compression = require("compression");

// database for users and records
var sqlite3 = require("sqlite3");
var db = new sqlite3.Database('./database.sqlite3');

// authentication
var passport = require("passport");
var userAuth = require("./user-auth");
userAuth.setupAuth(passport, db);

// Zawgyi converter
var knayi = require("knayi-myscript");

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
app.get('/status', passport.authenticate('local', {
  successRedirect: '/goodstatus',
  failureRedirect: '/badstatus'
}));

app.get('/goodstatus', function(req, res) {
  res.json({ status: { server: "ok", user: "ok" } });
});

app.get('/badstatus', function(req, res) {
  res.json({ status: { server: "ok", user: "loggedout" } });
});

// type form sections
app.get('/type-form', passport.authenticate('local'), function(req, res) {
  res.render('form');
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

app.post('/login', passport.authenticate('local', {
  successRedirect: '/type-form',
  failureRedirect: '/login?state=failed'
}));

// launch the server process
var server = app.listen(process.env.PORT || 3000, function() {
  var port = server.address().port;
  console.log('Serving on http://localhost:' + port);
});

module.exports = app;
