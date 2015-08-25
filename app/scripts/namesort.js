names = myanmarNameSort(names);

var prevname = null;
for (var n = 0; n < names.length; n++) {
  if (names[n] === prevname) {
    continue;
  }
  prevname = names[n];
  var list = document.createElement("li");
  list.innerHTML = names[n];
  document.getElementById("namelist").appendChild(list);
}
