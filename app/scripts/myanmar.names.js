function myanmarNameSort(namelist, namefinder) {
  if (typeof Intl === "undefined" || typeof Intl.Collator === "undefined") {
    throw "Intl.Collator not available";
  }
  var prefixes = [
    "အရှင်",
    "အသျှင်",
    "ဗညား",
    "ဗညာ",
    "ဗိုလ်ချုပ်",
    "ဗိုလ်",
    "ဒေါ်",
    "ဒူးဝါး",
    "ကြီး",
    "ခွန်",
    "ဦး",
    "နိုင်",
    "မယ်",
    "မန်း",
    "နန်း",
    "နော်",
    "စိုင်း",
    "ဆလိုင်း",
    "စဝ်",
    "စော",
    "စော်ဘွား",
    "ဒေါက်တာ",
    "ဆရာတော်",
    "ဆရာမ",
    "ဆရာ",
    "ရှင်",
    "သျှင်",
    "တက္ကသိုလ်",
    "သခင်",
    "သိပ္ပံ",
    "Dr.",
    "Dr",
    "MD"
  ];

  function trim(x) {
    return x.replace(/^\s+|\s+$/gm,'');
  }

  // Intl.Collator has to happen on the client side
  var collator = new Intl.Collator("my-MM");

  return namelist.sort(function(a, b) {
    if (namefinder && typeof namefinder === 'function') {
      a = namefinder(a);
      b = namefinder(b);
    }
    a = trim(a);
    b = trim(b);
    for (var p = 0; p < prefixes.length; p++) {
      if (a.indexOf(prefixes[p]) === 0) {
        a = trim(a.replace(prefixes[p], ''));
      }
      if (b.indexOf(prefixes[p]) === 0) {
        b = trim(b.replace(prefixes[p], ''));
      }
    }
    return collator.compare(a, b);
  });
}
