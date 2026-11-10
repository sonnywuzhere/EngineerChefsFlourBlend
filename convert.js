// EngineerChef's Flour Blend
// For every 1 1/4 cups (1.25 cups) of regular flour:
//   1/2 cup 1-to-1 gluten-free flour (Bob's Red Mill or King Arthur)
//   1/2 cup almond flour
//   1/4 cup coconut flour
// The three flours together equal the regular flour by volume.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FlourSwap = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var BASE_CUPS = 1.25;
  var RATIO = { oneToOne: 0.5, almond: 0.5, coconut: 0.25 };

  // Spoon-and-level cup weights.
  // Regular flour and King Arthur flours: King Arthur Baking ingredient weight chart.
  // Bob's 1-to-1: Bob's Red Mill flour weight chart (148 g per cup).
  var REGULAR_CUP_GRAMS = 120;
  var WEIGHTS = {
    oneToOne: { bobs: 148, kingArthur: 120 },
    almond: 96,
    coconut: 128,
  };

  // Simple spoon measures round to the nearest tablespoon (16 per cup).
  // Exact spoon measures round to the nearest teaspoon (48 per cup).
  // Eighth-cup and quarter-cup steps drop coconut flour on small recipes.
  var TBSP_PER_CUP = 16;
  var TSP_PER_CUP = 48;
  var TSP_PER_TBSP = 3;
  var Q_PER_CUP = 192;

  var QUARTER_FRACTIONS = [
    null,
    { num: 1, den: 4 },
    { num: 1, den: 2 },
    { num: 3, den: 4 },
  ];

  var UNICODE_FRACTIONS = {
    "½": "1/2",
    "⅓": "1/3",
    "⅔": "2/3",
    "¼": "1/4",
    "¾": "3/4",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
  };

  function parseAmount(raw) {
    if (raw == null) return null;
    var text = String(raw).trim().toLowerCase();
    if (!text) return null;

    text = text.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, function (ch) {
      return " " + UNICODE_FRACTIONS[ch];
    });
    text = text.replace(/cups?|tablespoons?|tbsp|teaspoons?|tsp|grams?|gs?\b/g, " ");
    text = text.replace(/,/g, "");
    text = text.replace(/\s+/g, " ").trim();
    if (!text) return null;

    var mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixed) {
      var denom = Number(mixed[3]);
      if (denom === 0) return NaN;
      return Number(mixed[1]) + Number(mixed[2]) / denom;
    }

    var frac = text.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      var bottom = Number(frac[2]);
      if (bottom === 0) return NaN;
      return Number(frac[1]) / bottom;
    }

    if (/^\d*\.?\d+$/.test(text)) return Number(text);
    return NaN;
  }

  function cupsFromInput(amount, unit) {
    if (unit === "grams") return amount / REGULAR_CUP_GRAMS;
    return amount;
  }

  function amountValue(amount) {
    return (amount.whole || 0) + (amount.num ? amount.num / amount.den : 0);
  }

  function unitWord(unit, amount) {
    var plural = amountValue(amount) > 1;
    if (unit === "cup") return plural ? "cups" : "cup";
    if (unit === "teaspoon") return plural ? "teaspoons" : "teaspoon";
    return plural ? "tablespoons" : "tablespoon";
  }

  function amountPlain(amount) {
    if (amount.whole && amount.num) return amount.whole + " " + amount.num + "/" + amount.den;
    if (amount.whole) return String(amount.whole);
    return amount.num + "/" + amount.den;
  }

  function measure(whole, num, den, unit) {
    var amount = { whole: whole || 0, num: num || 0, den: den || 1 };
    return {
      type: "measure",
      amount: amount,
      unit: unit,
      plain: amountPlain(amount) + " " + unitWord(unit, amount),
    };
  }

  var UNDER_TBSP = {
    plain: "Under 1 tablespoon",
    parts: [{ type: "tiny", plain: "Under 1 tablespoon" }],
    tablespoons: 0,
    teaspoons: 0,
  };

  var UNDER_PRECISE = {
    plain: "Under 0.01 teaspoon",
    parts: [{ type: "tiny", plain: "Under 0.01 teaspoon" }],
    tablespoons: 0,
    teaspoons: 0,
  };

  function cupMeasure(whole, fraction) {
    if (fraction) return measure(whole, fraction.num, fraction.den, "cup");
    return measure(whole, 0, 1, "cup");
  }

  function formatTbsp(tbsp) {
    var whole = Math.floor(tbsp / TBSP_PER_CUP);
    var rem = tbsp % TBSP_PER_CUP;
    var quarter = Math.floor(rem / 4);
    var leftover = rem % 4;
    var parts = [];
    var fraction = QUARTER_FRACTIONS[quarter];
    if (whole || fraction) parts.push(cupMeasure(whole, fraction));
    if (leftover) parts.push(measure(leftover, 0, 1, "tablespoon"));
    return {
      plain: parts.map(function (part) { return part.plain; }).join(" + "),
      parts: parts,
      tablespoons: tbsp,
      teaspoons: tbsp * TSP_PER_TBSP,
    };
  }

  function tspFromMilli(milli) {
    var divisor = gcd(milli, 1000);
    var num = milli / divisor;
    var den = 1000 / divisor;
    var whole = Math.floor(num / den);
    var rem = num % den;
    if (rem !== 0 && den <= 10) return measure(whole, rem, den, "teaspoon");
    if (rem === 0) return measure(whole, 0, 1, "teaspoon");
    var text = (milli / 1000).toFixed(3).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    var value = Number(text);
    return {
      type: "measure",
      amount: { whole: 0, num: 0, den: 1, text: text },
      unit: "teaspoon",
      plain: text + (value > 1 ? " teaspoons" : " teaspoon"),
    };
  }

  // Precise spoon amounts keep thousandths of a teaspoon so the spoons
  // describe the same weight as the gram line.
  function formatPreciseMilli(milli) {
    var wholeTbsp = Math.floor(milli / 3000);
    var remMilli = milli % 3000;
    var whole = Math.floor(wholeTbsp / TBSP_PER_CUP);
    var remTbsp = wholeTbsp % TBSP_PER_CUP;
    var quarter = Math.floor(remTbsp / 4);
    var leftoverTbsp = remTbsp % 4;
    var parts = [];
    var fraction = QUARTER_FRACTIONS[quarter];
    if (whole || fraction) parts.push(cupMeasure(whole, fraction));
    if (leftoverTbsp) parts.push(measure(leftoverTbsp, 0, 1, "tablespoon"));
    if (remMilli) parts.push(tspFromMilli(remMilli));
    return {
      plain: parts.map(function (part) { return part.plain; }).join(" + "),
      parts: parts,
      tablespoons: milli / 3000,
      teaspoons: milli / 1000,
    };
  }

  function preciseMilli(cups) {
    return Math.max(0, Math.round(cups * TSP_PER_CUP * 1000));
  }

  function formatVolume(cups, precision) {
    if (!Number.isFinite(cups) || cups <= 0) {
      return { plain: "", parts: [], tablespoons: 0, teaspoons: 0 };
    }
    if (precision === "exact") {
      var milli = preciseMilli(cups);
      if (milli <= 0) return UNDER_PRECISE;
      return formatPreciseMilli(milli);
    }
    var tbsp = Math.round(cups * TBSP_PER_CUP);
    if (tbsp <= 0) return UNDER_TBSP;
    return formatTbsp(tbsp);
  }

  function formatGrams(grams) {
    if (!Number.isFinite(grams) || grams <= 0) return "0 g";
    var rounded = Math.round(grams);
    if (rounded <= 0) return "< 1 g";
    return rounded.toLocaleString("en-US") + " g";
  }

  function formatExactGrams(grams) {
    if (!Number.isFinite(grams) || grams <= 0) return "0 g";
    var thousandths = Math.round(grams * 1000) / 1000;
    if (thousandths <= 0) return "< 0.01 g";
    var trimmed = thousandths.toFixed(3).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    var pieces = trimmed.split(".");
    pieces[0] = Number(pieces[0]).toLocaleString("en-US");
    return pieces.join(".") + " g";
  }

  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }

  function formatInputAmount(value, unit) {
    if (!Number.isFinite(value)) return "";
    if (unit === "grams") {
      return String(Math.round(value));
    }
    var q = Math.round(value * Q_PER_CUP);
    if (q <= 0) return "0";
    var whole = Math.floor(q / Q_PER_CUP);
    var rem = q % Q_PER_CUP;
    if (rem === 0) return String(whole);
    var divisor = gcd(rem, Q_PER_CUP);
    var num = rem / divisor;
    var den = Q_PER_CUP / divisor;
    if (den <= 8) {
      if (whole) return whole + " " + num + "/" + den;
      return num + "/" + den;
    }
    var rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
  }

  function convert(regularCups, brand, precision) {
    var exact = precision === "exact";
    var scale = regularCups / BASE_CUPS;
    var chosen = brand === "kingArthur" ? "kingArthur" : "bobs";
    var keys = ["oneToOne", "almond", "coconut"];
    var flours = {};
    var totalSpoons = 0;
    var totalMilli = 0;
    var totalGrams = 0;
    keys.forEach(function (key) {
      var exactCups = RATIO[key] * scale;
      var perCup = key === "oneToOne" ? WEIGHTS.oneToOne[chosen] : WEIGHTS[key];
      var spoons;
      var volume;
      var grams;
      var gramsLabel;
      if (exact) {
        // Grams are the true weight. Spoons follow that weight, even below 1 teaspoon.
        var milli = preciseMilli(exactCups);
        grams = milli > 0 ? (milli * perCup) / (TSP_PER_CUP * 1000) : exactCups * perCup;
        var shown = Math.round(grams * 1000) / 1000;
        gramsLabel = shown <= 0 && grams > 0 ? "< 0.01 g" : formatExactGrams(shown);
        volume = milli > 0 ? formatPreciseMilli(milli) : UNDER_PRECISE;
        spoons = milli / 1000;
        totalMilli += milli;
        totalGrams += shown > 0 ? shown : 0;
      } else {
        spoons = Math.max(0, Math.round(exactCups * TBSP_PER_CUP));
        // Rounded grams follow the tablespoon scoops.
        grams = (spoons > 0 ? spoons / TBSP_PER_CUP : exactCups) * perCup;
        var shownGrams = grams > 0 && Math.round(grams) <= 0 ? 0 : Math.round(grams);
        gramsLabel = shownGrams <= 0 && grams > 0 ? "< 1 g" : formatGrams(shownGrams);
        volume = spoons > 0 ? formatTbsp(spoons) : UNDER_TBSP;
        totalSpoons += spoons;
        totalGrams += shownGrams > 0 ? shownGrams : 0;
      }
      flours[key] = {
        cups: exactCups,
        tablespoons: exact ? spoons / TSP_PER_TBSP : spoons,
        teaspoons: exact ? spoons : spoons * TSP_PER_TBSP,
        volume: volume,
        grams: grams,
        gramsLabel: gramsLabel,
      };
    });
    var totalVolume = exact
      ? totalMilli > 0
        ? formatPreciseMilli(totalMilli)
        : UNDER_PRECISE
      : totalSpoons > 0
        ? formatTbsp(totalSpoons)
        : UNDER_TBSP;
    return {
      regularCups: regularCups,
      brand: chosen,
      precision: exact ? "exact" : "simple",
      flours: flours,
      total: {
        tablespoons: exact ? totalMilli / 3000 : totalSpoons,
        teaspoons: exact ? totalMilli / 1000 : totalSpoons * TSP_PER_TBSP,
        volume: totalVolume,
        grams: totalGrams,
        gramsLabel: exact ? formatExactGrams(totalGrams) : formatGrams(totalGrams),
      },
    };
  }

  return {
    BASE_CUPS: BASE_CUPS,
    RATIO: RATIO,
    REGULAR_CUP_GRAMS: REGULAR_CUP_GRAMS,
    WEIGHTS: WEIGHTS,
    parseAmount: parseAmount,
    cupsFromInput: cupsFromInput,
    formatVolume: formatVolume,
    formatGrams: formatGrams,
    formatExactGrams: formatExactGrams,
    formatInputAmount: formatInputAmount,
    convert: convert,
  };
});
