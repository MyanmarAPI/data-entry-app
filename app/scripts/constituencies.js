
var group_names = [];
var current_constituency = null;
var current_constituency_number = null;
var current_ul = null;

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

var closeLastGroup = function() {
  if (group_names && group_names.length) {
    group_names = myanmarNameSort(group_names, function(candidate) {
      return candidate.full_name
    });

    var current_ul = document.createElement("ul");
    document.body.appendChild(current_ul);
    for (var i = 0; i < group_names.length; i++) {
      var candidate = document.createElement("li");
      candidate.innerHTML = group_names[i].full_name + " (" + group_names[i].national_id + ")";
      current_ul.appendChild(candidate);
    }
    group_names = [];
  }
}

for (var c = 0; c < candidates.length; c++) {
  if (current_constituency !== candidates[c].constituency_name) {
    closeLastGroup();

    addConName(candidates[c].constituency_name);
    if (candidates[c].constituency_number) {
      addConNumber(candidates[c].constituency_number);
    }

  } else if (candidates[c].constituency_number && current_constituency_number !== candidates[c].constituency_number) {
    closeLastGroup();
    addConNumber(candidates[c].constituency_number);
  }

  group_names.push(candidates[c]);
}
closeLastGroup();
