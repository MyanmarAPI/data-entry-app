var fs = require('fs');
var csv = require('fast-csv');
var sqlite3 = require("sqlite3");

// candidate final db?
var db = new sqlite3.Database('./official.sqlite3');

// original db
var matches = new sqlite3.Database('./database.sqlite3');

// convert numbers
var myanmarNumbers = require('myanmar-numbers').myanmarNumbers;

// lower house constituencies - official names
var lower = require('./data/lower_house.json');

// natid normalization / matching
var nat_id_sql =
"REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(norm_national_id, 'နိုင်', 'XOX'), 'နို်င', 'XOX'), ' ', ''), '-', ''), '.', ''), '/', ''), '့်', '့်'),'(', ''), ')', ''), '−', ''), '၊', ''), 'ပဘ', 'သဘ')";


// party normalization
var fixnames = require('./data/fixnames.json');
var id_by_party_name = require('./data/idbp.json');

// get the name of the state for a township
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

// normalize a national ID
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

// output candidates for this house
var csvStream = csv.createWriteStream({headers: true});
var corrected = fs.createWriteStream("./lower_house_candidates.csv");
csvStream.pipe(corrected);

var errorStream = csv.createWriteStream({headers: true});
var closed = fs.createWriteStream("./lower_house_unmatched.csv");
errorStream.pipe(closed);

// rebuild the official DB
db.run('DELETE FROM candidates', function (err) {
  if (err) {
    throw err;
  }

  //doUpperHouse();
  doLowerHouse();
  //doStatesRegions();
});

/* structure
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
          // states and regions house
          con_name = (candidate[1].split(/\s/)[0] || '').split('(')[0].replace(/\s/g, '').replace(/့်/g, '့်');
          con_number = '';
          if (candidate[1].match(/\(/)) {
            con_number = myanmarNumbers(candidate[1].split('(')[1].split(')')[0]);
          }
          name = candidate[2].replace(/\s/g, '').replace(/့်/g, '့်');
          party = candidate[3] || '';
        } else {
          // lower house
          con_name = candidate[1].replace(/\s/g, '').replace(/့်/g, '့်');
          con_number = 0;
          name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
          party = candidate[4];
        }
        state = getState(con_name);

      } else {
        // upper house
        con_name = candidate[1].split(' - ')[0];
        state = con_name.replace(/\s/g, '').replace(/့်/g, '့်');
		    con_number = myanmarNumbers(candidate[1].split(' - ')[1]);
        name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
        party = candidate[4];
      }

      // if there is no name match, candidates get a second pass at name-matching
      // setname is that more-fuzzy name
      if (setname) {
        name = setname;
      }

      // remove blank chars
      name = name.replace(/​/g, '');
      party = (party || '').replace(/​/g, '');
      con_name = (con_name || '').replace(/​/g, '');
      state = (state || '').replace(/​/g, '');

      // change name into a like query
      // drop prefixes U and Daw
      var searchname = name;
      if (searchname.indexOf('ဦး') === 0) {
        searchname = '%' + name.replace('ဦး', '');
      } else if (searchname.indexOf('ဒေါ်') === 0) {
        searchname = '%' + name.replace('ဒေါ်', '');
      } else {
        searchname = '%' + name;
      }

      // normally this is the only normalization done on names
      var full_name_sql = "REPLACE(REPLACE(full_name, ' ', ''), '့်', '့်')";

      // if the first attempt did not find any name matches
      // these replacements are made to combine similar-looking letters
      var replaces = [
        ['ဂ', 'ဝ'],
        ['က','တ'],
        ['ထ','တ'],
        ['ယ','တ'],
        ['(', ''],
        [')', ''],
        ['ာ', 'ါ'],
        ['့်', '့်'],
        ['ဥ', 'ဉ'],
        ['ဦ', 'ဉ']
      ];
      if (setname) {
        for (var r = 0; r < replaces.length; r++) {
          full_name_sql = "REPLACE(" + full_name_sql + ", '" + replaces[r][0] + "', '" + replaces[r][1] + "')";
        }
      }

      // search our original DB for filter info

		  matches.all("SELECT id, gender, full_name, form_id, party, constituency_number, constituency_name, national_id, norm_national_id, \
		        verified, house, form_id, 'consensus_form' AS source FROM consensus_forms WHERE " + full_name_sql + " LIKE ? UNION \
		        SELECT id, gender, full_name, form_id, party, constituency_number, constituency_name, national_id, norm_national_id, \
		        verified, house, form_id, 'entry' AS source FROM entries WHERE " + full_name_sql + " LIKE ?  ORDER BY source, verified DESC, form_id DESC, id DESC", [searchname, searchname], function (err, people) {
		          if (!people.length) {
                // no results? retry with a more fuzzy name query if you can
                var original_name = name;
                for (var r = 0; r < replaces.length; r++) {
                  while (name.indexOf(replaces[r][0]) > -1) {
                    name = name.replace(replaces[r][0], replaces[r][1]);
                  }
                }

                if (original_name === name) {
                  // none of the fuzz replacements changed this candidate's name
                  // not worth rerunning their name
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
                  // go run with fuzz
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
                // normalize the national ID
		            var normid = normalizeNatId(people[p].norm_national_id);
		            if (natids.length && natids.indexOf(normid) === -1) {
                  // during this loop, if you find national IDs which don't match each other; you have multiple people showing up in results
                  // we'll use multimatch to identify how serious this is later
		              multimatch = true;
		            }
                // keep track of any good national ids and photos
		            natids.push(normid);
                formids.push(people[p].form_id);

                // keep track of the best-result photo, entry, and consensus form
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
                // ok there are multiple ids in your results
                // let's see if some have a matching ID prefix or suffix
                // this would make them the same person
                // foundBlocker = true if we find someone whose ID is just TOO different
                var foundBlocker = false;
		            for (var n = 0; n < natids.length - 1; n++) {
		              if (natids[n].length < 5 || !natids[n].match(/\d\d/)) {
                    // this ID was not a good format
                    // I'm not sure what to do with it
                    console.log('bad nid');
		                foundBlocker = true;
		                break;
		              }
		              if (!(natids[n].split('XOX')[0] === natids[n+1].split('XOX')[0]) && !(natids[n].split('XOX')[1] === natids[n+1].split('XOX')[1])
                   && !(formids[n] && formids[n+1] && formids[n] === formids[n+1])) {
                     // this ID was just TOO different
                     // definitely two or more people share this name
		                 foundBlocker = true;
		                 break;
		              }
		            }
		            if (foundBlocker) {
                  // there are multiple IDs, but you can get another chance to save matches
                  // we're going to check if there are any factors which match once (for example, only one person with this name who has the right constituency or party)
                  // when we're done we'll need this savePeople function
                  var savePeople = function (uniques) {
                    // uniques is a list of normal ids which equal that one candidate
                    formids = [];
                    best_entry = null;
                    best_source = [];
                    best_consensus = null;
                    found_form = 0;
                    for (var p = 0; p < people.length; p++) {
                      // only look at data from the person with this person's ID
                      var normid = normalizeNatId(people[p].norm_national_id);
                      if (uniques.indexOf(normid) === -1) {
                        continue;
                      }

                      // look for the best image, entry, consensus form
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

                  // before I start looking for individual matches (party, constituency), I should keep score in case one is an obvious winner across multiple categories
                  var points_by_id = {};

                  if (multimatch) {
                    // normalize constituency name and then check for matches

                    var adjust_con_name = con_name.replace(/ပြည်နယ်|မြို့နယ်|တိုင်းဒေသကြီး|မဲဆန္ဒနယ်/g, '');
                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.constituency_name.indexOf(adjust_con_name) > -1) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid] = 1;
                      } else {
                        points_by_id[normid] = 0;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                  if (multimatch) {
                    // normalize party name and then check for matches
                    var adjust_party_name = party;
                    for (var f = 0; f < fixnames.length; f++) {
                      if (adjust_party_name.indexOf(fixnames[f][0]) > -1) {
                        partyid = fixnames[f][1];
                        adjust_party_name = id_by_party_name[partyid - 1][1];
                      }
                    }

                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.party.indexOf(party) > -1 || party.indexOf(person.party) > -1 || adjust_party_name.indexOf(person.party) > -1 || person.party.indexOf(adjust_party_name) > -1) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid]++;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                  if (multimatch) {
                    // check for house match
                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.house === house) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid]++;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                  if (multimatch) {
                    // check if only one has been verified
                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.verified) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid]++;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                  if (multimatch && con_number) {
                    var adjust_party_name = party;
                    for (var f = 0; f < fixnames.length; f++) {
                      if (adjust_party_name.indexOf(fixnames[f][0]) > -1) {
                        partyid = fixnames[f][1];
                        adjust_party_name = id_by_party_name[partyid - 1][1];
                      }
                    }

                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.party.indexOf(party) > -1 || party.indexOf(person.party) > -1 || adjust_party_name.indexOf(person.party) > -1 || person.party.indexOf(adjust_party_name) > -1) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid]++;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                  if (multimatch) {
                    // check for house match
                    var uniques = [];
                    people.map(function (person) {
                      var normid = normalizeNatId(person.norm_national_id);
                      if (person.constituency_number === con_number) {
                        if (!uniques.length) {
                          // at least one person is a match
                          multimatch = false;
                        }
                        if (normid && uniques.length && uniques.indexOf(normid) === -1) {
                          // ok, now we are back to 2+ people; multimatch = true
                          multimatch = true;
                        }
                        if (normid) {
                          uniques.push(normid);
                        }

                        // add a point
                        points_by_id[normid]++;
                      }
                    });

                    if (!multimatch) {
                      // I just ended the multimatch
                      // better save this record
                      savePeople(uniques);
                    }
                  }

                    if (multimatch) {
                      // final chance - score the natids by number of matches made
                      // look for a leader
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

                // after I find out this person's photo, I'm going to save them to the database and I'm going to output them to the CSV
                var saveForm = function() {
                  // here's where I update the candidate DB
                  db.run("UPDATE candidates SET form_id = ?, best_consensus_id = ?, best_entry_id = ? WHERE full_name = ? AND constituency = ? AND constituency_number = ? AND party = ?", [found_form, best_consensus, best_entry, name, con_name, con_number, party], function (err) {
                    if (err) {
                      throw err;
                    }

                    // here's all of the info that we share on the CSV
                    matches.get('SELECT gender, religion, ward_village, voter_list_number, dob, nationality, father, father_ethnicity, father_religion, mother, mother_ethnicity, mother_religion, occupation, education FROM ' + best_source[0] + ' WHERE id = ?', best_source[1], function (err, row) {
                      if (err) {
                        throw err;
                      }

                      // output CSV in this order
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
                };

  		          if (found_form) {
                  // this is easy - if I have a photo then save it
                  saveForm();
                } else {
                  // if I found a person but not their photo, search the original DB for other people with that ID who *do* have a photo
                  var normid;
                  if (!people.length || !best_source.length) {
                    return advance();
                  }
                  for (var q = 0; q < people.length; q++) {
                    if (people[q].source === best_source[0] && people[q].id === best_source[1]) {
                      normid = normalizeNatId(people[q].norm_national_id);
                      break;
                    }
                  }
                  matches.get("SELECT form_id, saved FROM entries WHERE form_id > 0 AND " + nat_id_sql + " = ? UNION SELECT form_id, saved FROM consensus_forms WHERE form_id > 0 AND " + nat_id_sql + " = ? ORDER BY saved DESC", [normid, normid], function (err, row) {
                    if (err) {
                      throw err;
                    }
                    if (row) {
                      //console.log('refound form: ' + row.form_id);
                      found_form = row.form_id;
                      saveForm();
                    } else {
                      // still not able to find this photo
                      console.log('person but not form for ' + name);
                      advance();
                    }
                  });
  		          }



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

  // load the UEC TSV list
  // we've done some modifications and canidate rejections and overall improvements to the underlying WinResearcher file, so PLEASE do not update the TSV itself
  csv.fromPath('./data/lower_house_norm.tsv', { delimiter: '\t' })
    .on('data', function (data) {
      // the constituency isn't repeated on every line, so I track it here
      if (data[1]) {
        activeConstituency = data[1];
      } else {
        data[1] = activeConstituency;
      }

      // some rows are just a constituency name, so they shouldn't be run through the candidates system
      if (data.length < 4) {
        return;
      }
      candidates.push(data);
    })
    .on('end', function () {
      var lastConstituency = null;


    // each candidate row goes through here
    function addCandidate (c) {
      // parsing what I know about the candidate at this time
      var candidate = candidates[c];
      candidate[0] = 'ပြည်သူ့လွှတ်တော်';
      var con_name = candidate[1];
      var name = candidate[3].replace(/\s/g, '').replace(/့်/g, '့်');
      var party = candidate[4] || '';

      if (!party.length) {
        // these are weird rows
        console.log(candidates[c]);
      }

      // get state name not from the CSV but from the official JSON file
      state = getState(con_name);

      candidate[5] = state;
      lastConstituency = con_name;

      function advance() {
        // advance to the next candidate or finish
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
        // no point in working with a nameless candidate
        return advance();
      }

      // add this candidate to the final DB
      var cvalues = "'" + ['ပြည်သူ့လွှတ်တော်', con_name, 0, name, party.replace(/'/g, '"')].join("','") + "'";
      db.run('INSERT INTO candidates (house, constituency, constituency_number, full_name, party) VALUES (' + cvalues + ')', function (err) {
        if (err) {
          throw err;
        }

        // try to find the rest of the details on this candidate
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
