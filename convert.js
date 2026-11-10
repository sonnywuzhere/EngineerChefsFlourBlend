// EngineerChef's Flour Blend
// For every 1 1/4 cups (1.25 cups) of regular flour:
//   1/2 cup 1-to-1 gluten-free flour (Bob's Red Mill or King Arthur)
//   1/2 cup almond flour
//   1/4 cup coconut flour
// Cups mode keeps that volume. Grams mode scales the same mix so the three
// flours weigh the same as the regular flour (120 g per cup). The page shows
// only the unit the cook selected.

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
  // Volume shares of the written blend: 2/5, 2/5, and 1/5.
  var SHARE = { oneToOne: 2, almond: 2, coconut: 1 };

  // Spoon measures use whole tablespoons (16 per cup). The three flours add
  // up to the regular flour, so a line may move by a tablespoon.
  var TBSP_PER_CUP = 16;
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

  function formatVolume(cups) {
    if (!Number.isFinite(cups) || cups <= 0) {
      return { plain: "", parts: [], tablespoons: 0, teaspoons: 0 };
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

  function perCupGrams(key, chosen) {
    return key === "oneToOne" ? WEIGHTS.oneToOne[chosen] : WEIGHTS[key];
  }

  // 2/5, 2/5, and 1/5 of a cup, weighed with the chosen 1-to-1 bag.
  function blendWeightNumerator(chosen) {
    return (
      SHARE.oneToOne * WEIGHTS.oneToOne[chosen] +
      SHARE.almond * WEIGHTS.almond +
      SHARE.coconut * WEIGHTS.coconut
    );
  }

  // Split a whole-number target so the parts add back to it.
  function splitThousandths(rawThousandths, targetThousandths) {
    var parts = rawThousandths.map(function (exact, index) {
      var nearest = Math.round(exact);
      if (Math.abs(exact - nearest) < 1e-6) {
        return { floor: nearest, frac: 0, index: index };
      }
      var floor = Math.floor(exact);
      return { floor: floor, frac: exact - floor, index: index };
    });
    var used = 0;
    parts.forEach(function (part) {
      used += part.floor;
    });
    var leftover = targetThousandths - used;
    var order = parts.slice().sort(function (a, b) {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.index - b.index;
    });
    var step = leftover > 0 ? 1 : -1;
    var guard = 0;
    while (leftover !== 0 && order.length && guard < 10000) {
      var part = order[guard % order.length];
      if (step > 0 || part.floor > 0) {
        part.floor += step;
        leftover -= step;
      }
      guard += 1;
    }
    return parts.map(function (part) {
      return part.floor;
    });
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

  function weightShares(regularCups, chosen, keys, target) {
    var blend = blendWeightNumerator(chosen);
    return splitThousandths(
      keys.map(function (key) {
        return (SHARE[key] * perCupGrams(key, chosen) * target) / blend;
      }),
      target
    );
  }

  // Whole tablespoons that add up to the regular flour. A line can move by
  // one tablespoon so the total still matches.
  function scoopFromTablespoons(spoons, perCup, exactCups) {
    var gramCups = spoons > 0 ? spoons / TBSP_PER_CUP : exactCups;
    var grams = gramCups * perCup;
    var shownGrams = grams > 0 && Math.round(grams) <= 0 ? 0 : Math.round(grams);
    return {
      spoons: spoons,
      volume: spoons > 0 ? formatTbsp(spoons) : UNDER_TBSP,
      grams: grams,
      gramsLabel: shownGrams <= 0 && grams > 0 ? "< 1 g" : formatGrams(shownGrams),
      shownGrams: shownGrams > 0 ? shownGrams : 0,
      milli: 0,
    };
  }

  function convert(regularCups, brand, unit) {
    var byWeight = unit === "grams";
    var scale = regularCups / BASE_CUPS;
    var chosen = brand === "kingArthur" ? "kingArthur" : "bobs";
    var keys = ["oneToOne", "almond", "coconut"];
    var flours = {};
    var totalSpoons = 0;
    var totalGrams = 0;
    var shownWeight = [];
    var targetWeight = 0;
    var shownTbsp = [];
    if (byWeight) {
      targetWeight = Math.max(0, Math.round(regularCups * REGULAR_CUP_GRAMS));
      shownWeight = weightShares(regularCups, chosen, keys, targetWeight);
    } else {
      var targetTbsp = Math.max(0, Math.round(regularCups * TBSP_PER_CUP));
      var shareTotal = SHARE.oneToOne + SHARE.almond + SHARE.coconut;
      shownTbsp = splitThousandths(
        keys.map(function (key) {
          return (SHARE[key] * targetTbsp) / shareTotal;
        }),
        targetTbsp
      );
    }
    keys.forEach(function (key, index) {
      var exactCups = RATIO[key] * scale;
      var perCup = perCupGrams(key, chosen);
      var grams;
      var gramsLabel;
      var scoop;
      if (byWeight) {
        exactCups = (SHARE[key] * regularCups * REGULAR_CUP_GRAMS) / blendWeightNumerator(chosen);
        grams = shownWeight[index];
        gramsLabel = formatGrams(grams);
        scoop = scoopFromTablespoons(Math.max(0, Math.round(exactCups * TBSP_PER_CUP)), perCup, exactCups);
        totalGrams += grams;
      } else {
        scoop = scoopFromTablespoons(shownTbsp[index], perCup, exactCups);
        grams = scoop.grams;
        gramsLabel = scoop.gramsLabel;
        totalGrams += scoop.shownGrams;
      }
      totalSpoons += scoop.spoons;
      flours[key] = {
        cups: exactCups,
        tablespoons: scoop.spoons,
        teaspoons: scoop.spoons * TSP_PER_TBSP,
        volume: scoop.volume,
        grams: grams,
        gramsLabel: gramsLabel,
      };
    });
    return {
      regularCups: regularCups,
      brand: chosen,
      unit: byWeight ? "grams" : "cups",
      flours: flours,
      total: {
        tablespoons: totalSpoons,
        teaspoons: totalSpoons * TSP_PER_TBSP,
        volume: totalSpoons > 0 ? formatTbsp(totalSpoons) : UNDER_TBSP,
        grams: byWeight ? targetWeight : totalGrams,
        gramsLabel: byWeight ? formatGrams(targetWeight) : formatGrams(totalGrams),
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
    formatInputAmount: formatInputAmount,
    convert: convert,
  };
});
