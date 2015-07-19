var crypto = require("crypto");
var LocalStrategy = require('passport-local').Strategy;

var hashPassword = function(password, salt) {
  var hash = crypto.createHash('sha256');
  hash.update(password);
  hash.update(salt);
  return hash.digest('hex');
};

module.exports = {
  createUser: function(req, db, callback) {
    var salt = process.env.SALT || 'ekcweio92dmqbd';
    var salted_password = hashPassword(req.body.password, salt);

    db.get("INSERT INTO users (username, password, salt) VALUES ('" + [req.body.username, salted_password, salt].join("','") + "')", function(err) {
      if (err) {
        throw err;
      }
      callback();
    });
  },

  setupAuth: function(passport, db) {
    console.log('using');
    passport.use('local-login', new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true
    },
    function(req, email, password, done){
      db.get('SELECT * FROM users WHERE username = ?', req.body.email, function(err, user) {
        if(err){
          console.log('error');
          return done(err);
        }
        if(!user){
          console.log('no user');
          return done(null, false, req.flash('loginMessage', 'No user found.'));
        }
        if (hashPassword(req.body.password, user.salt) != user.password) {
          console.log('bad password');
          return done(null, false, req.flash('loginMessage', 'Bad password.'));
        }
        return done(null, user);
      });
    }));

    passport.serializeUser(function(user, done) {
      return done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
      db.get('SELECT id, username FROM users WHERE id = ?', id, function(err, row) {
        if (!row) return done(null, false);
        return done(null, row);
      });
    });
  }
}
