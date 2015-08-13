var prefixes = [
  "ဒေါ်",
  "Dr.",
  "Dr",
  "MD",
  "ဦး",
  "ဒေါက်တာ"
];

// Intl.Collator has to happen on the client side
var collator = new Intl.Collator("my-MM");

names = names.sort(function(a, b) {
  a = a.trim();
  b = b.trim();
  for (var p = 0; p < prefixes.length; p++) {
    if (a.indexOf(prefiex[p]) === 0) {
      a = a.replace(prefixes[p], '').trim();
    }
    if (b.indexOf(prefixes[p]) === 0) {
      b = b.replace(prefixes[p], '').trim();
    }
  }
  return collator.compare(a, b);
});

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
