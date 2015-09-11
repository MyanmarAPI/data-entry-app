var fs = require('fs');
var csv = require('fast-csv');
var sqlite3 = require("sqlite3");
var db = new sqlite3.Database('./official.sqlite3');

var matches = new sqlite3.Database('./database.sqlite3');

var myanmarNumbers = require('myanmar-numbers').myanmarNumbers;

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
  console.log('didnt find township (' + township + "/" + searchTownship + ')')
}

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

var csvStream = csv.createWriteStream({headers: true});
var corrected = fs.createWriteStream("./lower_house_candidates.csv");
csvStream.pipe(corrected);

var errorStream = csv.createWriteStream({headers: true});
var closed = fs.createWriteStream("./lower_house_unmatched.csv");
errorStream.pipe(closed);

db.run('DELETE FROM candidates', function (err) {
  if (err) {
    throw err;
  }

  //doUpperHouse();
  doLowerHouse();
  //doStatesRegions();
});

/*
CREATE TABLE candidates (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "form_id" INTEGER,
    "house" TEXT,
    "full_name" TEXT,
    "constituency" TEXT,
    "constituency_number" INTEGER,
    "party" TEXT,
    "best_consensus_id" INTEGER,
    "best_entry_id" INTEGER
);
*/

function processCandidate(candidate, advance, islower, setname) {
      var original_candidate = candidate.concat([]);
  		var con_name, con_number, state, name, party;
      var house = candidate[0];
      if (islower) {
        if (islower === 'state') {
          con_name = (candidate[1].split(/\s/)[0] || '').split('(')[0].replace(/\s/g, '').replace(/့်/g, '့်');
          con_number = '';
          if (candidate[1].match(/\(/)) {
            con_number = myanmarNumbers(candidate[1].split('(')[1].split(')')[0]);
          }
          name = candidate[2].replace(/\s/g, '').replace(/့်/g, '့်');
          party = candidate[3] || '';
        } else {
          con_name = candidate[1].replace(/\s/g, '').replace(/့်/g, '့်');
          con_number = 0;
          //state = candidate[5];
          name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
          party = candidate[4];
        }
        state = getState(con_name);

      } else {
        con_name = candidate[1].split(' - ')[0];
        state = con_name.replace(/\s/g, '').replace(/့်/g, '့်');
		    con_number = myanmarNumbers(candidate[1].split(' - ')[1]);
        name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
        party = candidate[4];
      }

      name = name.replace(/​/g, '');
      if (setname) {
        name = setname;
      }

      party = (party || '').replace(/​/g, '');
      con_name = (con_name || '').replace(/​/g, '');
      state = (state || '').replace(/​/g, '');

      var searchname = name;
      if (searchname.indexOf('ဦး') === 0) {
        searchname = '%' + name.replace('ဦး', '');
      } else if (searchname.indexOf('ဒေါ်') === 0) {
        searchname = '%' + name.replace('ဒေါ်', '');
      } else {
        searchname = '%' + name;
      }

      // used when fuzzing
      var replaces = [
        ['ဂ', 'ဝ'],
        ['က','တ'],
        ['ထ','တ'],
        ['\\(', ''],
        ['\\)', '']
      ];

      var full_name_sql = "REPLACE(REPLACE(full_name, ' ', ''), '့်', '့်')";

      if (setname) {
        for (var r = 0; r < replaces.length; r++) {
          full_name_sql = "REPLACE(" + full_name_sql + ", '" + replaces[r][0] + "', '" + replaces[r][1] + "')";
        }
      }

		  matches.all("SELECT id, gender, full_name, form_id, party, constituency_number, constituency_name, national_id, norm_national_id, \
		        verified, house, form_id, 'consensus_form' AS source FROM consensus_forms WHERE " + full_name_sql + " LIKE ? UNION \
		        SELECT id, gender, full_name, form_id, party, constituency_number, constituency_name, national_id, norm_national_id, \
		        verified, house, form_id, 'entry' AS source FROM entries WHERE " + full_name_sql + " LIKE ?  ORDER BY source, verified DESC, form_id DESC, id DESC", [searchname, searchname], function (err, people) {
		          if (!people.length) {
                var original_name = name;

                for (var r = 0; r < replaces.length; r++) {
                  name = name.replace(new RegExp(replaces[r][0], 'g'), replaces[r][1]);
                }

                if (original_name === name) {
                  errorStream.write({
                    house: house,
                    state: state,
                    constituency_name: con_name,
                    constituency_number: con_number,
                    name: name,
                    party: party
                  });
		              console.log('no matches: (' + name + ')');
                  return advance();
                } else {
                  return processCandidate(original_candidate, advance, islower, name);
                }
		          }

		          var natids = [];
              var formids = [];
		          var multimatch = false;
		          var found_form = 0;
		          var best_consensus = 0;
		          var best_entry = 0;
              var best_source = [];
		          for (var p = 0; p < people.length; p++) {
		            var normid = normalizeNatId(people[p].norm_national_id);
		            if (natids.length && natids.indexOf(normid) === -1) {
		              multimatch = true;
		            }
		            natids.push(normid);
                formids.push(people[p].form_id);
		            if (!found_form && people[p].form_id) {
		              found_form = people[p].form_id;
		            }
		            if (!best_entry && people[p].source === 'entry') {
		               best_entry = people[p].id;
                   if (!best_source.length) {
                     best_source = ['entries', best_entry];
                   }
		            }
		            if (!best_consensus && people[p].source === 'consensus_form') {
		               best_consensus = people[p].id;
                   if (!best_source.length) {
                     best_source = ['consensus_forms', best_consensus];
                   }
		            }
		          }

              if (multimatch) {
                var foundBlocker = false;
		            for (var n = 0; n < natids.length - 1; n++) {
		              if (natids[n].length < 5 || !natids[n].match(/\d\d/)) {
		                foundBlocker = true;
		                break;
		              }
		              if (!(natids[n].split('XOX')[0] === natids[n+1].split('XOX')[0]) && !(natids[n].split('XOX')[1] === natids[n+1].split('XOX')[1])
                   && !(formids[n] && formids[n+1] && formids[n] === formids[n+1])) {
		                 //console.log(natids[n] + ' and ' + formids[n]);
		                 //console.log(natids[n+1] + ' and ' + formids[n+1]);
		                 foundBlocker = true;
		                 break;
		              }
		            }
		            if (foundBlocker) {
                  var savePeople = function (uniques) {
                    formids = [];
                    best_entry = null;
                    best_source = [];
                    best_consensus = null;
                    found_form = 0;
                    for (var p = 0; p < people.length; p++) {
                      var normid = normalizeNatId(people[p].norm_national_id);
                      if (uniques.indexOf(normid) === -1) {
                        continue;
                      }
                      formids.push(people[p].form_id);
                      if (!found_form && people[p].form_id) {
                        found_form = people[p].form_id;
                      }
                      if (!best_entry && people[p].source === 'entry') {
                         best_entry = people[p].id;
                         if (!best_source.length) {
                           best_source = ['entries', best_entry];
                         }
                      }
                      if (!best_consensus && people[p].source === 'consensus_form') {
                         best_consensus = people[p].id;
                         if (!best_source.length) {
                           best_source = ['consensus_forms', best_consensus];
                         }
                      }
                    }
                  };

                  var points_by_id = {};

                  if (multimatch) {
                    var adjust_con_name = con_name.replace(/ပြည်နယ်|မြို့နယ်|တိုင်းဒေသကြီး|မဲဆန္ဒနယ်/g, '');
                    var ids_with_constituency_match = people.map(function (person) {
                      if (person.constituency_name.indexOf(adjust_con_name) > -1) {
                        multimatch = false;
                        points_by_id[normalizeNatId(person.norm_national_id)] = 1;
                        return normalizeNatId(person.norm_national_id);
                      } else {
                        points_by_id[normalizeNatId(person.norm_national_id)] = 0;
                        return '';
                      }
                    });

                    if (!multimatch) {
                      var uniques = [];
                      for (var i = 0; i < ids_with_constituency_match.length; i++) {
                        var normid = ids_with_constituency_match[i];
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }
                      }
                      if (!multimatch) {
                        savePeople(uniques);
                      }
                    }
                  }

                  if (multimatch) {
                    var ids_with_party = people.map(function (person) {
                      if (person.party === party) {
                        multimatch = false;
                        return normalizeNatId(person.norm_national_id);
                      } else {
                        return null;
                      }
                    });
                    if (!multimatch) {
                      var uniques = [];
                      for (var i = 0; i < ids_with_party.length; i++) {
                        var normid = ids_with_party[i];
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          multimatch = true;
                        }
                        if (ids_with_party[i]) {
                          uniques.push(normid);
                          points_by_id[normid]++;
                        }
                      }
                      //console.log(uniques);

                      if (!multimatch) {
                        //console.log('fixing by party');
                        savePeople(uniques);
                      }
                    }
                  }

                  if (multimatch) {
                    var ids_with_house = people.map(function (person) {
                      if (person.house === house) {
                        multimatch = false;
                        return normalizeNatId(person.norm_national_id);
                      } else {
                        return null;
                      }
                    });
                    if (!multimatch) {
                      var uniques = [];
                      for (var i = 0; i < ids_with_house.length; i++) {
                        var normid = ids_with_house[i];
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          multimatch = true;
                        }
                        if (ids_with_house[i]) {
                          uniques.push(normid);
                          points_by_id[normid]++;
                        }
                      }
                      //console.log(uniques);

                      if (!multimatch) {
                        savePeople(uniques);
                      }
                    }
                  }

                  if (multimatch) {
                    var ids_with_verified = people.map(function (person) {
                      if (person.verified) {
                        multimatch = false;
                        return normalizeNatId(person.norm_national_id);
                      } else {
                        return null;
                      }
                    });
                    if (!multimatch) {
                      var uniques = [];
                      for (var i = 0; i < ids_with_verified.length; i++) {
                        var normid = ids_with_verified[i];
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          multimatch = true;
                        }
                        if (ids_with_verified[i]) {
                          uniques.push(normid);
                          points_by_id[normid]++;
                        }
                      }
                      //console.log(uniques);

                      if (!multimatch) {
                        //console.log('fixing by verified');
                        savePeople(uniques);
                      }
                    }
                  }

                  if (multimatch && con_number) {
                    var ids_with_con_number = people.map(function (person) {
                      if (person.constituency_number == con_number) {
                        multimatch = false;
                        return normalizeNatId(person.norm_national_id);
                      } else {
                        return null;
                      }
                    });
                    if (!multimatch) {
                      var uniques = [];
                      for (var i = 0; i < ids_with_con_number.length; i++) {
                        var normid = ids_with_con_number[i];
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          multimatch = true;
                        }
                        if (ids_with_con_number[i]) {
                          uniques.push(normid);
                          points_by_id[normid]++;
                        }
                      }
                      //console.log(uniques);

                      if (!multimatch) {
                        //console.log('fixing by verified');
                        savePeople(uniques);
                      }
                    }
                  }

                    if (multimatch) {
                      var normids = Object.keys(points_by_id);
                      normids.sort(function (a, b) {
                        return points_by_id[b] - points_by_id[a];
                      });

                      if (points_by_id[normids[0]] > points_by_id[normids[1]]) {
                        var uniques = [];
                        for (var p = 0; p < people.length; p++) {
                          if (normalizeNatId(people[p].norm_national_id) === normids[0]) {
                            uniques.push(people[p].norm_national_id);
                          }
                        }
                        savePeople(uniques);
                      } else {
      		              console.log('multiple IDs for ' + name);
                        //console.log(people);
                        //return;
    		                //console.log(natids);
      		              return advance();
                      }
                    }
  		            }
  		          }

  		          if (!found_form) {
  		             console.log('person but not form for ' + name);
  		             return advance();
  		          }

  		          db.run("UPDATE candidates SET form_id = ?, best_consensus_id = ?, best_entry_id = ? WHERE full_name = ? AND constituency = ? AND constituency_number = ? AND party = ?", [found_form, best_consensus, best_entry, name, con_name, con_number, party], function (err) {
  		            if (err) {
  		              throw err;
  		            }

                  matches.get('SELECT gender, religion, ward_village, voter_list_number, dob, nationality, father, father_ethnicity, father_religion, mother, mother_ethnicity, mother_religion, occupation, education FROM ' + best_source[0] + ' WHERE id = ?', best_source[1], function (err, row) {
                    if (err) {
                      throw err;
                    }

                    var outrow = {
                      house: house,
                      state: state,
                      constituency_name: con_name,
                      constituency_number: con_number,
                      full_name: name,
                      photo_id: found_form,
                      party: party,
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

    		            advance();
                  });
  		          });

		        });
}

function doUpperHouse() {
  var candidates = [];
  var lastConstituency = null;
	csv.fromPath('./data/upper_house.tsv', { delimiter: '\t' })
	  .on('data', function (data) {
  		if (data[1]) {
  		  activeConstituency = data[1];
        if (activeConstituency !== lastConstituency && lastConstituency) {
          csvStream.write({ state: activeConstituency, constituency_name: activeConstituency });
        }
  		} else {
  		  data[1] = activeConstituency;
  		}
      if (data.length < 4) {
        return;
      }
  		candidates.push(data);
	  })
	  .on('end', function () {
		function addCandidate (c) {
		  var candidate = candidates[c];
      candidate[0] = 'အမျိုးသားလွှတ်တော်';
		  var con_name = candidate[1].split(' - ')[0];
		  var con_number = myanmarNumbers(candidate[1].split(' - ')[1]);
		  var name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
		  var party = candidate[4];

		  function advance() {
  			// advance
  			c++;
  			if (!(c % 50)) {
  			  console.log("-- " + c);
  			}
  			if (c < candidates.length) {
  			  addCandidate(c);
  			} else {
  			  console.log('done upper house');
          corrected.end();
          errorStream.end();
          //doLowerHouse();
  			}
		  }

		  var cvalues = "'" + ['အမျိုးသားလွှတ်တော်', con_name, con_number, name, party.replace(/'/g, '"')].join("','") + "'";
		  db.run('INSERT INTO candidates (house, constituency, constituency_number, full_name, party) VALUES (' + cvalues + ')', function (err) {
		    if (err) {
		      throw err;
		    }

		    processCandidate(candidate, advance);
		  });
		}
		addCandidate(0);
	});
}

function doLowerHouse() {
  var candidates = [];
  var activeConstituency = null;
  csv.fromPath('./data/lower_house_norm.tsv', { delimiter: '\t' })
    .on('data', function (data) {
      if (data[1]) {
        activeConstituency = data[1];
      } else {
        data[1] = activeConstituency;
      }
      if (data.length < 4) {
        return;
      }
      candidates.push(data);
    })
    .on('end', function () {
      var lastConstituency = null;
    function addCandidate (c) {
      var candidate = candidates[c];
      candidate[0] = 'ပြည်သူ့လွှတ်တော်';
      var con_name = candidate[1];
      var name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
      var party = candidate[4] || '';
      if (!party.length) {
        console.log(candidates[c]);
      }
      state = getState(con_name);

      candidate[5] = state;
      lastConstituency = con_name;

      function advance() {
        // advance
        c++;
        if (!(c % 50)) {
          console.log("-- " + c);
        }
        if (c < candidates.length) {
          addCandidate(c);
        } else {
          console.log('done');
          corrected.end();
        }
      }

      if (!name || !con_name) {
        return advance();
      }

      var cvalues = "'" + ['ပြည်သူ့လွှတ်တော်', con_name, 0, name, party.replace(/'/g, '"')].join("','") + "'";
      db.run('INSERT INTO candidates (house, constituency, constituency_number, full_name, party) VALUES (' + cvalues + ')', function (err) {
        if (err) {
          throw err;
        }

        processCandidate(candidate, advance, true);
      });
    }
    addCandidate(0);
  });
}

function doStatesRegions() {
  var candidates = [];
  csv.fromPath('./data/states_regions_norm.tsv', { delimiter: '\t' })
    .on('data', function (data) {
      if (data[1]) {
        activeConstituency = data[1];
      } else {
        data[1] = activeConstituency;
      }
      if (data.length < 4) {
        return;
      }
      candidates.push(data);
    })
    .on('end', function () {
      var state = 'ရှမ်းပြည်နယ်';
      var lastConstituency = null;
    function addCandidate (c) {
      var candidate = candidates[c];
      candidate[0] = 'တိုင်းဒေသကြီး/ပြည်နယ် လွှတ်တော်';
      var con_name = candidate[1].split(/\s/)[1] || '';
      var con_number = '';
      if (candidate[1].match(/\(/)) {
        con_number = myanmarNumbers(candidate[1].split('(')[1].split(')')[0]);
      }
      var name = candidate[2].replace(/\s/g, '').replace(/့်/g, '့်');
      var party = candidate[3] || '';

      //candidate[5] = state;
      if (con_name !== lastConstituency && lastConstituency) {
        csvStream.write({ state: state, constituency_name: con_name });
      }
      lastConstituency = con_name;

      function advance() {
        // advance
        c++;
        if (!(c % 50)) {
          console.log("-- " + c);
        }
        if (c < candidates.length) {
          addCandidate(c);
        } else {
          console.log('done');
          corrected.end();
        }
      }

      if (con_name.indexOf('ပြည်နယ်') > -1 || con_name.indexOf('ဒေသကြီး') > -1) {

        state = con_name;
        return advance();
      }

      var cvalues = "'" + ['ပြည်သူ့လွှတ်တော်', con_name, 0, name, party.replace(/'/g, '"')].join("','") + "'";
      db.run('INSERT INTO candidates (house, constituency, constituency_number, full_name, party) VALUES (' + cvalues + ')', function (err) {
        if (err) {
          throw err;
        }

        processCandidate(candidate, advance, 'state');
      });
    }
    addCandidate(0);
  });
}
