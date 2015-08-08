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
  for (var p = 0; p < prefixes.length; p++) {
    a = a.replace(prefixes[p], '').trim();
    b = b.replace(prefixes[p], '').trim();
  }
  return collator.compare(a, b);
});

for (var n = 0; n < names.length; n++) {
  var list = document.createElement("li");
  list.innerHTML = names[n];
  document.getElementById("namelist").appendChild(list);
}
