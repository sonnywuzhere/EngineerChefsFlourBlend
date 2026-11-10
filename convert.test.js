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
      const result = swap.convert(cups, brand, "cups");
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

test("rounded grams add up to the regular flour", function () {
  const bobs = swap.convert(1, "bobs", "grams");
  assert.equal(bobs.flours.oneToOne.gramsLabel, "58 g");
  assert.equal(bobs.flours.almond.gramsLabel, "37 g");
  assert.equal(bobs.flours.coconut.gramsLabel, "25 g");
  assert.equal(bobs.total.gramsLabel, "120 g");

  const kingArthur = swap.convert(1, "kingArthur", "grams");
  assert.equal(kingArthur.flours.oneToOne.gramsLabel, "52 g");
  assert.equal(kingArthur.flours.almond.gramsLabel, "41 g");
  assert.equal(kingArthur.flours.coconut.gramsLabel, "27 g");
  assert.equal(kingArthur.total.gramsLabel, "120 g");
});
