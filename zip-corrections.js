var fs = require('fs');
var sqlite3 = require('sqlite3');
var csv = require('fast-csv');
var md5 = require('md5');

var candidates = new sqlite3.Database('./official.sqlite3');
var correct = new sqlite3.Database('./corrected.sqlite3');
var npt = new sqlite3.Database('./database.sqlite3');

var lower = require('./data/lower_house.json');
function getState (township, i) {
  if (!township) {
    return '';
  }
  var searchTownship = '';
  for (var s = 0; s < township.length; s++) {
    if (township.charCodeAt(s) < 65000) {
      searchTownship += township[s];
    }
  }

  searchTownship = searchTownship.replace('မဲဆန္ဒနယ်', '').replace('မြို့နယ်','').replace(/မြို့/g, '');

  for (var state in lower) {
    for (var c = 0; c < lower[state].constituencies.length; c++) {
      if (lower[state].constituencies[c].replace('မြို့နယ်','').replace(/မြို့/g, '') === searchTownship) {
        return lower[state].area;
      }
    }
  }
}


candidates.all('SELECT full_name, constituency, constituency_number, party FROM candidates WHERE best_entry_id IS NULL AND best_consensus_id IS NULL', function (err, unmatched) {
  if (err) {
    throw err;
  }

  console.log(unmatched.length);

  var csvStream = csv.createWriteStream({headers: true});
  var extras = fs.createWriteStream("./extra_candidates.csv");
  csvStream.pipe(extras);

  function zipCandidate(z) {

    if (z >= unmatched.length) {
      extras.end();
      return;
    }

    var myCandidate = unmatched[z];

    correct.get('SELECT * FROM candidates WHERE full_name = ? AND constituency = ? AND constituency_number = ? AND party = ?', [myCandidate.full_name, myCandidate.constituency, myCandidate.constituency_number, myCandidate.party], function (err, correction) {
      if (err) {
        throw err;
      }

      if (!correction) {
        console.log([myCandidate.full_name, myCandidate.constituency, myCandidate.constituency_number, myCandidate.party]);
        return zipCandidate(z + 1);
      }

      var source, source_id;
      if (correction.best_entry_id) {
        source = 'entries';
        source_id = correction.best_entry_id;
      } else {
        source = 'consensus_forms';
        source_id = correction.best_consensus_id;
      }

      if (!source_id) {
        return makeCorrection(c + 1);
      }

      npt.get('SELECT * FROM ' + source + ' WHERE id = ?', source_id, function (err, row) {
        if (err) {
          throw err;
        }
        var house = correction.house;
        var state = getState(correction.constituency);
        var con_name = correction.constituency;
        var con_number = correction.constituency_number;
        var name = correction.full_name;

        var outrow = {
          candidate_id: md5([house, con_name, con_number, name, correction.party].join(';')),
          house: house,
          state: state,
          constituency_name: con_name,
          constituency_number: con_number,
          full_name: name,
          photo_id: 0,
          party: correction.party,
          gender: row.gender,
          birthdate: row.dob,
          occupation: row.occupation,
          education: row.education,
          nationality: row.nationality,
          religion: row.religion,
          ward_village: row.ward_village,
          voter_list_number: row.voter_list_number,
          father: row.father,
          father_nationality: row.father_ethnicity,
          father_religion: row.father_religion,
          mother: row.mother,
          mother_nationality: row.mother_ethnicity,
          mother_religion: row.mother_religion
        };

        csvStream.write(outrow);

        zipCandidate(z + 1);
      });
    });
  }
  zipCandidate(0);
});
