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

test("1 cup rounds to the nearest tablespoon and keeps the blend", function () {
  const result = swap.convert(1, "bobs");
  assert.equal(result.flours.oneToOne.volume.plain, "1/4 cup + 2 tablespoons");
  assert.equal(result.flours.almond.volume.plain, "1/4 cup + 2 tablespoons");
  assert.equal(result.flours.coconut.volume.plain, "3 tablespoons");
  assert.equal(result.flours.oneToOne.gramsLabel, "56 g");
  assert.equal(result.flours.almond.gramsLabel, "36 g");
  assert.equal(result.flours.coconut.gramsLabel, "24 g");
  assert.equal(result.total.volume.plain, "3/4 cup + 3 tablespoons");
  assert.equal(result.total.gramsLabel, "116 g");
  assert.equal(result.total.tablespoons, 15);
  assert.equal(result.flours.oneToOne.volume.plain.includes("teaspoon"), false);
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

test("precise mode matches the gram weight, including a small teaspoon", function () {
  const written = swap.convert(1.25, "bobs", "exact");
  assert.equal(written.flours.oneToOne.volume.plain, "1/2 cup");
  assert.equal(written.flours.almond.volume.plain, "1/2 cup");
  assert.equal(written.flours.coconut.volume.plain, "1/4 cup");
  assert.equal(written.flours.oneToOne.gramsLabel, "74 g");
  assert.equal(written.precision, "exact");

  const one = swap.convert(1, "bobs", "exact");
  assert.equal(one.flours.oneToOne.volume.plain, "1/4 cup + 2 tablespoons + 1 1/5 teaspoons");
  assert.equal(one.flours.almond.volume.plain, "1/4 cup + 2 tablespoons + 1 1/5 teaspoons");
  assert.equal(one.flours.coconut.volume.plain, "3 tablespoons + 3/5 teaspoon");
  assert.equal(one.flours.oneToOne.gramsLabel, "59.2 g");
  assert.equal(one.flours.almond.gramsLabel, "38.4 g");
  assert.equal(one.flours.coconut.gramsLabel, "25.6 g");
  assert.equal(one.total.volume.plain, "1 cup");
  assert.equal(one.total.gramsLabel, "123.2 g");
  assert.equal(one.total.teaspoons, 48);
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
