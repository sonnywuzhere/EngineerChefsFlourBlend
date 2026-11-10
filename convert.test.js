const test = require("node:test");
const assert = require("node:assert/strict");
const swap = require("./convert");

test("parses kitchen amounts", function () {
  assert.equal(swap.parseAmount("1 1/4"), 1.25);
  assert.equal(swap.parseAmount("2/3"), 2 / 3);
  assert.equal(swap.parseAmount("1.5"), 1.5);
  assert.equal(swap.parseAmount("1/2"), 0.5);
  assert.equal(swap.parseAmount("2 1/2 cups"), 2.5);
  assert.equal(swap.parseAmount("1½"), 1.5);
  assert.equal(swap.parseAmount("½"), 0.5);
  assert.equal(swap.parseAmount("1,250"), 1250);
  assert.equal(swap.parseAmount(""), null);
  assert.equal(swap.parseAmount("   "), null);
  assert.equal(Number.isNaN(swap.parseAmount("lots")), true);
  assert.equal(Number.isNaN(swap.parseAmount("1/0")), true);
});

test("the written ratio is exact at 1 1/4 cups", function () {
  const result = swap.convert(1.25, "bobs");
  assert.equal(result.flours.oneToOne.volume.plain, "1/2 cup");
  assert.equal(result.flours.almond.volume.plain, "1/2 cup");
  assert.equal(result.flours.coconut.volume.plain, "1/4 cup");
  assert.equal(result.flours.oneToOne.gramsLabel, "74 g");
  assert.equal(result.flours.almond.gramsLabel, "48 g");
  assert.equal(result.flours.coconut.gramsLabel, "32 g");
});

test("King Arthur 1-to-1 changes grams only", function () {
  const result = swap.convert(1.25, "kingArthur");
  assert.equal(result.flours.oneToOne.volume.plain, "1/2 cup");
  assert.equal(result.flours.oneToOne.gramsLabel, "60 g");
  assert.equal(result.flours.almond.gramsLabel, "48 g");
});

test("150 grams of regular flour matches 1 1/4 cups", function () {
  const cups = swap.cupsFromInput(150, "grams");
  assert.equal(cups, 1.25);
  const result = swap.convert(cups, "bobs");
  assert.equal(result.flours.oneToOne.volume.plain, "1/2 cup");
  assert.equal(result.flours.coconut.volume.plain, "1/4 cup");
});

test("1 cup rounds to tablespoons and still totals 1 cup", function () {
  const result = swap.convert(1, "bobs");
  assert.equal(result.flours.oneToOne.volume.plain, "1/4 cup + 3 tablespoons");
  assert.equal(result.flours.almond.volume.plain, "1/4 cup + 2 tablespoons");
  assert.equal(result.flours.coconut.volume.plain, "3 tablespoons");
  assert.equal(result.flours.oneToOne.gramsLabel, "65 g");
  assert.equal(result.flours.almond.gramsLabel, "36 g");
  assert.equal(result.flours.coconut.gramsLabel, "24 g");
  assert.equal(result.total.volume.plain, "1 cup");
  assert.equal(result.total.gramsLabel, "125 g");
  assert.equal(result.total.tablespoons, 16);
  assert.equal(result.flours.oneToOne.volume.plain.includes("teaspoon"), false);
});

test("rounded tablespoons add up to the regular flour", function () {
  [0.25, 0.5, 2 / 3, 1, 1.25, 2, 3.5].forEach(function (cups) {
    ["bobs", "kingArthur"].forEach(function (brand) {
      const result = swap.convert(cups, brand, "simple", "cups");
      const target = Math.round(cups * 16);
      const parts =
        result.flours.oneToOne.tablespoons +
        result.flours.almond.tablespoons +
        result.flours.coconut.tablespoons;
      assert.equal(parts, target);
      assert.equal(result.total.tablespoons, target);
    });
  });
});

test("2 cups rounds without teaspoons", function () {
  const result = swap.convert(2, "bobs");
  assert.equal(result.flours.oneToOne.volume.plain, "3/4 cup + 1 tablespoon");
  assert.equal(result.flours.coconut.volume.plain, "1/4 cup + 2 tablespoons");
  assert.equal(result.flours.oneToOne.gramsLabel, "120 g");
  assert.equal(result.flours.almond.gramsLabel, "78 g");
  assert.equal(result.flours.coconut.gramsLabel, "48 g");
  assert.equal(result.total.volume.plain, "2 cups");
  assert.equal(result.total.tablespoons, 32);
});

test("volume formatter uses cups and tablespoons only", function () {
  assert.equal(swap.formatVolume(1).plain, "1 cup");
  assert.equal(swap.formatVolume(2).plain, "2 cups");
  assert.equal(swap.formatVolume(0.5).plain, "1/2 cup");
  assert.equal(swap.formatVolume(0.25).plain, "1/4 cup");
  assert.equal(swap.formatVolume(0.75).plain, "3/4 cup");
  assert.equal(swap.formatVolume(1 / 3).plain, "1/4 cup + 1 tablespoon");
  assert.equal(swap.formatVolume(2 / 3).plain, "1/2 cup + 3 tablespoons");
  assert.equal(swap.formatVolume(1.25).plain, "1 1/4 cups");
  assert.equal(swap.formatVolume(1 / 48).plain, "Under 1 tablespoon");
  assert.equal(swap.formatVolume(2 / 16).plain, "2 tablespoons");
  assert.equal(swap.formatVolume(0.00001).plain, "Under 1 tablespoon");
  assert.equal(swap.formatVolume(1.8).plain, "1 3/4 cups + 1 tablespoon");
  assert.equal(swap.formatVolume(0.4).plain, "1/4 cup + 2 tablespoons");
});

test("input formatting round-trips the toggle", function () {
  assert.equal(swap.formatInputAmount(1.25, "cups"), "1 1/4");
  assert.equal(swap.formatInputAmount(2 / 3, "cups"), "2/3");
  assert.equal(swap.formatInputAmount(2, "cups"), "2");
  assert.equal(swap.formatInputAmount(150, "grams"), "150");
});

test("precise cups add up to the regular flour", function () {
  const one = swap.convert(1, "bobs", "exact", "cups");
  assert.equal(one.unit, "cups");
  assert.equal(one.flours.oneToOne.volume.plain, "1/4 cup + 2 tablespoons + 1 1/5 teaspoons");
  assert.equal(one.flours.almond.volume.plain, one.flours.oneToOne.volume.plain);
  assert.equal(one.flours.coconut.volume.plain, "3 tablespoons + 3/5 teaspoon");
  assert.equal(one.total.volume.plain, "1 cup");

  const written = swap.convert(1.25, "kingArthur", "exact", "cups");
  assert.equal(written.flours.oneToOne.volume.plain, "1/2 cup");
  assert.equal(written.flours.almond.volume.plain, "1/2 cup");
  assert.equal(written.flours.coconut.volume.plain, "1/4 cup");
  assert.equal(written.total.volume.plain, "1 1/4 cups");
});

test("precise grams weigh the same as the regular flour", function () {
  const cups = swap.cupsFromInput(120, "grams");
  assert.equal(cups, 1);

  const bobs = swap.convert(cups, "bobs", "exact", "grams");
  assert.equal(bobs.precision, "exact");
  assert.equal(bobs.flours.oneToOne.gramsLabel, "57.662 g");
  assert.equal(bobs.flours.almond.gramsLabel, "37.403 g");
  assert.equal(bobs.flours.coconut.gramsLabel, "24.935 g");
  assert.equal(bobs.total.gramsLabel, "120 g");
  assert.equal(bobs.flours.oneToOne.volume.plain, "1/4 cup + 2 tablespoons + 0.701 teaspoon");
  assert.equal(bobs.flours.almond.volume.plain, bobs.flours.oneToOne.volume.plain);
  assert.equal(bobs.flours.coconut.volume.plain, "3 tablespoons + 0.351 teaspoon");
  assert.equal(bobs.total.volume.plain, "3/4 cup + 3 tablespoons + 1.753 teaspoons");

  const kingArthur = swap.convert(cups, "kingArthur", "exact", "grams");
  assert.equal(kingArthur.flours.oneToOne.gramsLabel, "51.429 g");
  assert.equal(kingArthur.flours.almond.gramsLabel, "41.143 g");
  assert.equal(kingArthur.flours.coconut.gramsLabel, "27.428 g");
  assert.equal(kingArthur.total.gramsLabel, "120 g");
  assert.equal(
    kingArthur.flours.oneToOne.volume.plain,
    "1/4 cup + 2 tablespoons + 2.571 teaspoons"
  );
  assert.equal(kingArthur.flours.almond.volume.plain, kingArthur.flours.oneToOne.volume.plain);
  assert.equal(kingArthur.flours.coconut.volume.plain, "3 tablespoons + 1.286 teaspoons");
  assert.equal(kingArthur.total.volume.plain, "1 cup + 1 tablespoon + 0.428 teaspoon");

  const written = swap.convert(1.25, "bobs", "exact", "grams");
  assert.equal(written.flours.oneToOne.gramsLabel, "72.078 g");
  assert.equal(written.flours.almond.gramsLabel, "46.753 g");
  assert.equal(written.flours.coconut.gramsLabel, "31.169 g");
  assert.equal(written.total.gramsLabel, "150 g");

  const writtenKing = swap.convert(1.25, "kingArthur", "exact", "grams");
  assert.equal(writtenKing.flours.oneToOne.gramsLabel, "64.286 g");
  assert.equal(writtenKing.flours.almond.gramsLabel, "51.428 g");
  assert.equal(writtenKing.flours.coconut.gramsLabel, "34.286 g");
  assert.equal(writtenKing.total.gramsLabel, "150 g");
});

test("precise totals stay on the regular-flour weight", function () {
  function gramsOf(label) {
    return Number(label.replace(/,/g, "").replace(" g", ""));
  }
  [0.25, 0.5, 2 / 3, 1, 1.25, 2, 3.5, 10].forEach(function (cups) {
    ["bobs", "kingArthur"].forEach(function (brand) {
      const result = swap.convert(cups, brand, "exact", "grams");
      const target = Math.round(cups * swap.REGULAR_CUP_GRAMS * 1000) / 1000;
      const parts =
        gramsOf(result.flours.oneToOne.gramsLabel) +
        gramsOf(result.flours.almond.gramsLabel) +
        gramsOf(result.flours.coconut.gramsLabel);
      assert.equal(gramsOf(result.total.gramsLabel), target);
      assert.equal(Math.round(parts * 1000) / 1000, target);
    });
  });
});

test("rounded grams add up to the regular flour", function () {
  const bobs = swap.convert(1, "bobs", "simple", "grams");
  assert.equal(bobs.flours.oneToOne.gramsLabel, "58 g");
  assert.equal(bobs.flours.almond.gramsLabel, "37 g");
  assert.equal(bobs.flours.coconut.gramsLabel, "25 g");
  assert.equal(bobs.total.gramsLabel, "120 g");

  const kingArthur = swap.convert(1, "kingArthur", "simple", "grams");
  assert.equal(kingArthur.flours.oneToOne.gramsLabel, "52 g");
  assert.equal(kingArthur.flours.almond.gramsLabel, "41 g");
  assert.equal(kingArthur.flours.coconut.gramsLabel, "27 g");
  assert.equal(kingArthur.total.gramsLabel, "120 g");
});

test("precise volume keeps a fraction of a teaspoon", function () {
  assert.equal(swap.formatVolume(1 / 48, "exact").plain, "1 teaspoon");
  assert.equal(swap.formatVolume(2 / 48, "exact").plain, "2 teaspoons");
  assert.equal(swap.formatVolume(1 / 16, "exact").plain, "1 tablespoon");
  assert.equal(swap.formatVolume(1 / 3, "exact").plain, "1/4 cup + 1 tablespoon + 1 teaspoon");
  assert.equal(swap.formatVolume(0.4, "exact").plain, "1/4 cup + 2 tablespoons + 1 1/5 teaspoons");
  assert.equal(swap.formatVolume(1 / 384, "exact").plain, "1/8 teaspoon");
  assert.equal(swap.formatVolume(0.00001, "exact").plain, "Under 0.01 teaspoon");
  assert.equal(swap.formatVolume(1 / 48).plain, "Under 1 tablespoon");
});
