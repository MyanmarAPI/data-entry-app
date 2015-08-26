var candidates_by_constituency = {};

var group_names = [];
var current_constituency = null;
var current_constituency_number = null;
var current_ul = null;

var addStateName = function(name) {
  var nameline = document.createElement("h2");
  nameline.innerHTML = name;
  document.body.appendChild(nameline);
  current_constituency = name;
};

var addConName = function(name) {
  var nameline = document.createElement("h3");
  nameline.innerHTML = name;
  document.body.appendChild(nameline);
  current_constituency = name;
};

var addConNumber = function(num) {
  var numberline = document.createElement("h4");
  numberline.innerHTML = num;
  document.body.appendChild(numberline);
  current_constituency_number = num;
};

var addList = function(list) {
  var ul = document.createElement("table");
  ul.border = "1";
  document.body.appendChild(ul);
  for (var i = 0; i < list.length; i++) {
    var li = document.createElement("tr");
    li.innerHTML = "<td>" + list[i].full_name + "</td><td>" + list[i].national_id + "</td>";
    ul.appendChild(li);
  }
};

for (var c = 0; c < candidates.length; c++) {
  var candidate = candidates[c];
  if (!candidates_by_constituency[candidate.constituency_name]) {
    candidates_by_constituency[candidate.constituency_name] = [];
  }
  candidates_by_constituency[candidate.constituency_name].push(candidate);
}

function outputConstituencies(constituencies) {
  for (var c = 0; c < constituencies.length; c++) {
    var constituency = constituencies[c];
    if (house === "upper") {
      constituency = constituency.area;
    }

    addConName(constituency);

    var my_candidates = myanmarNameSort((candidates_by_constituency[constituency] || []), function(candidate) {
      return candidate.full_name;
    });

    if (house === "lower") {
      addList(my_candidates);
    }
    if (house === "upper") {
      for (var num = 1; num < 13; num++) {
        addConNumber(num);
        var con_candidates = [];
        for (var m = 0; m < my_candidates.length; m++) {
          if (my_candidates[m].constituency_number * 1 == num) {
            con_candidates.push(my_candidates[m]);
          }
        }
        addList(con_candidates);
      }
    }
  }
}

if (house === "lower") {
  for (var s = 0; s < constituencies.length; s++) {
    addStateName(constituencies[s].area);
    outputConstituencies(constituencies[s].constituencies);
  }
}
if (house === "upper") {
  outputConstituencies(constituencies);
}
