(function () {
  var form = document.getElementById("swap-form");
  var amountInput = document.getElementById("amount");
  var resultBody = document.getElementById("result-body");
  var unitButtons = Array.prototype.slice.call(document.querySelectorAll("[data-unit]"));
  var brandButtons = Array.prototype.slice.call(document.querySelectorAll("[data-brand]"));
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll("[data-preset]"));
  var precisionButtons = Array.prototype.slice.call(document.querySelectorAll("[data-precision]"));
  var precisionHelp = document.getElementById("precision-help");
  var roundingNote = document.getElementById("rounding-note");
  var brandNote = document.getElementById("brand-note");

  var unit = "cups";
  var brand = "bobs";
  var precision = "simple";
  var precisionChosen = false;
  var canonicalCups = null;
  var fieldIsGenerated = false;

  var FLOURS = {
    oneToOne: {
      name: "1-to-1 gluten-free flour",
      detail: {
        bobs: "Bob's Red Mill 1-to-1 Baking Flour",
        kingArthur: "King Arthur Measure for Measure",
      },
    },
    almond: {
      name: "Almond flour",
      detail: "Blanched. Spooned and leveled. Tree nut.",
    },
    coconut: {
      name: "Coconut flour",
      detail: "Spooned and leveled, not packed.",
    },
  };

  function selected(buttons, attr, value) {
    buttons.forEach(function (button) {
      var on = button.getAttribute(attr) === value;
      button.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function readingFromCups(cups) {
    if (cups > 10000) return { state: "huge" };
    var amount = unit === "grams" ? cups * FlourSwap.REGULAR_CUP_GRAMS : cups;
    return { state: "ok", cups: cups, amount: amount };
  }

  function currentCups() {
    if (fieldIsGenerated && canonicalCups != null) return readingFromCups(canonicalCups);
    var parsed = FlourSwap.parseAmount(amountInput.value);
    if (parsed == null) return { state: "empty" };
    if (!Number.isFinite(parsed)) return { state: "invalid" };
    if (parsed <= 0) return { state: "nonpositive" };
    var cups = FlourSwap.cupsFromInput(parsed, unit);
    if (cups > 10000) return { state: "huge" };
    canonicalCups = cups;
    return { state: "ok", cups: cups, amount: parsed };
  }

  function renderMeasure(volume) {
    if (!volume.parts.length) return "";
    if (volume.parts[0].type === "tiny") {
      return '<p class="measure tiny">' + volume.plain + "</p>";
    }
    return (
      '<p class="measure" aria-label="' +
      volume.plain +
      '"><span class="measure-line" aria-hidden="true">' +
      volume.parts
        .map(function (part, index) {
          var prefix = index ? '<span class="plus">+</span>' : "";
          return prefix + measureHtml(part);
        })
        .join("") +
      "</span></p>"
    );
  }

  function measureHtml(part) {
    var amount = part.amount;
    var bits = [];
    if (amount.text) {
      bits.push("<b>" + amount.text + "</b>");
    } else if (amount.whole) bits.push("<b>" + amount.whole + "</b>");
    if (!amount.text && amount.num) {
      bits.push(
        '<span class="frac"><b>' +
          amount.num +
          "</b><i></i><b>" +
          amount.den +
          "</b></span>"
      );
    }
    bits.push('<span class="unit-word">' + FlourSwapWord(part) + "</span>");
    return '<span class="chunk">' + bits.join("") + "</span>";
  }

  function FlourSwapWord(part) {
    var value = part.amount.text
      ? Number(part.amount.text)
      : (part.amount.whole || 0) +
        (part.amount.num ? part.amount.num / part.amount.den : 0);
    var plural = value > 1;
    if (part.unit === "cup") return plural ? "cups" : "cup";
    if (part.unit === "teaspoon") return plural ? "teaspoons" : "teaspoon";
    return plural ? "tablespoons" : "tablespoon";
  }

  function render() {
    var reading = currentCups();
    markPresets(reading);

    if (reading.state === "empty") {
      resultBody.innerHTML =
        '<div class="empty"><strong>The blend shows up here.</strong><p>Try 1 1/4 cups. That is the amount this swap was written for.</p></div>';
      return;
    }
    if (reading.state === "invalid") {
      resultBody.innerHTML =
        '<div class="error"><strong>That amount needs to be a number.</strong><p>Use something like 1 1/4, 2/3, or 150.</p></div>';
      return;
    }
    if (reading.state === "nonpositive") {
      resultBody.innerHTML =
        '<div class="error"><strong>Enter an amount above zero.</strong><p>A recipe flour line is a cup, a fraction, or a weight.</p></div>';
      return;
    }
    if (reading.state === "huge") {
      resultBody.innerHTML =
        '<div class="error"><strong>That is more flour than this page measures.</strong><p>Try an amount under 10,000 cups.</p></div>';
      return;
    }

    var result = FlourSwap.convert(reading.cups, brand, precision);
    var rows = ["oneToOne", "almond", "coconut"]
      .map(function (key) {
        var flour = result.flours[key];
        var meta = FLOURS[key];
        var detail = typeof meta.detail === "string" ? meta.detail : meta.detail[brand];
        return (
          '<article class="flour">' +
          '<div class="swatch ' +
          key +
          '" aria-hidden="true"></div>' +
          "<div>" +
          '<h3 class="flour-name">' +
          meta.name +
          "</h3>" +
          '<p class="flour-detail">' +
          detail +
          "</p>" +
          renderMeasure(flour.volume) +
          "</div>" +
          '<p class="grams">' +
          flour.gramsLabel +
          "<span>by weight</span></p>" +
          "</article>"
        );
      })
      .join("");

    var copyText = copyPlain(reading, result);
    resultBody.innerHTML =
      rows +
      '<div class="total">' +
      "<div>" +
      '<p class="eyebrow">Together</p>' +
      renderMeasure(result.total.volume) +
      "</div>" +
      '<p class="grams">' +
      result.total.gramsLabel +
      "<span>by weight</span></p>" +
      "</div>" +
      '<div class="copy"><button type="button" id="copy-swap">Copy the amounts</button></div>';
    document.getElementById("copy-swap").addEventListener("click", function () {
      copyAmounts(copyText, this);
    });
  }

  function copyPlain(reading, result) {
    var pretty = FlourSwap.formatInputAmount(reading.cups, "cups");
    var input =
      unit === "grams"
        ? FlourSwap.formatGrams(reading.amount).replace(" g", " grams")
        : pretty + (reading.cups > 1 ? " cups" : " cup");
    var lines = [
      "EngineerChef's Flour Blend",
      "Regular flour: " + input,
      precision === "exact"
        ? "Exact weight. The blend weighs the same as the regular flour."
        : "Rounded to the nearest tablespoon. These measurements will not be exact.",
      "",
    ];
    ["oneToOne", "almond", "coconut"].forEach(function (key) {
      var flour = result.flours[key];
      var name = FLOURS[key].name;
      if (key === "oneToOne") {
        name += brand === "kingArthur" ? " (King Arthur)" : " (Bob's Red Mill)";
      }
      lines.push(name + ": " + flour.volume.plain + " (" + flour.gramsLabel + ")");
    });
    lines.push("");
    lines.push("Together: " + result.total.volume.plain + " (" + result.total.gramsLabel + ")");
    return lines.join("\n");
  }

  function copyAmounts(text, button) {
    function done() {
      button.textContent = "Copied";
      button.setAttribute("data-state", "done");
      window.setTimeout(function () {
        button.textContent = "Copy the amounts";
        button.removeAttribute("data-state");
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text);
        done();
      });
      return;
    }
    fallbackCopy(text);
    done();
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }

  function markPresets(reading) {
    presetButtons.forEach(function (button) {
      var presetCups = Number(button.getAttribute("data-preset"));
      var on = reading.state === "ok" && Math.abs(reading.cups - presetCups) < 0.001;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function applyPrecision(next, chosen) {
    var precise = next === "exact" || next === "precise" || next === "teaspoons";
    precision = precise ? "exact" : "simple";
    if (chosen) precisionChosen = true;
    selected(precisionButtons, "data-precision", precision);
    updateMeasureCopy();
  }

  function updateMeasureCopy() {
    if (precision === "exact") {
      precisionHelp.textContent =
        "More precise makes the blend weigh the same as the regular flour. Weigh the grams. The spoons match those grams.";
      roundingNote.textContent =
        "The three flours add up to the regular flour by weight. The spoons match those grams, down to a small teaspoon.";
      brandNote.textContent =
        "Bob's and King Arthur use different spoon amounts here, so the blend still weighs the same as the regular flour.";
      return;
    }
    precisionHelp.textContent =
      "Rounded to the nearest tablespoon. This will not be exact. Select More precise for the exact gram weight.";
    roundingNote.textContent =
      "Rounded to the nearest tablespoon. This will not be exact. Select More precise for the exact gram weight.";
    brandNote.textContent =
      "The cup amount stays the same either way. Grams for the 1-to-1 follow the bag you buy.";
  }

  function setUnit(next) {
    if (next === unit) return;
    var reading = currentCups();
    unit = next;
    selected(unitButtons, "data-unit", unit);
    amountInput.placeholder = unit === "cups" ? "1 1/4" : "150";
    amountInput.setAttribute("inputmode", unit === "grams" ? "numeric" : "decimal");
    if (reading.state === "ok") {
      canonicalCups = reading.cups;
      fieldIsGenerated = true;
      var shown = unit === "grams" ? reading.cups * FlourSwap.REGULAR_CUP_GRAMS : reading.cups;
      amountInput.value = FlourSwap.formatInputAmount(shown, unit);
    }
    if (!precisionChosen) applyPrecision(unit === "grams" ? "exact" : "simple", false);
    else updateMeasureCopy();
    updatePresetLabels();
    render();
  }

  function updatePresetLabels() {
    var labels =
      unit === "grams"
        ? ["120 g", "150 g", "240 g"]
        : ["1 cup", "1 1/4 cups", "2 cups"];
    presetButtons.forEach(function (button, index) {
      button.textContent = labels[index];
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  amountInput.addEventListener("input", function () {
    fieldIsGenerated = false;
    render();
  });

  unitButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setUnit(button.getAttribute("data-unit"));
    });
  });

  brandButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      brand = button.getAttribute("data-brand");
      selected(brandButtons, "data-brand", brand);
      render();
    });
  });

  precisionButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyPrecision(button.getAttribute("data-precision"), true);
      render();
    });
  });

  presetButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var cups = Number(button.getAttribute("data-preset"));
      canonicalCups = cups;
      fieldIsGenerated = true;
      if (unit === "grams") {
        amountInput.value = FlourSwap.formatInputAmount(cups * FlourSwap.REGULAR_CUP_GRAMS, "grams");
      } else {
        amountInput.value = FlourSwap.formatInputAmount(cups, "cups");
      }
      render();
      amountInput.focus();
    });
  });

  var params = new URLSearchParams(window.location.search);
  if (params.get("demo")) {
    amountInput.value = params.get("demo");
  }
  if (params.get("unit") === "grams") setUnit("grams");
  var measure = params.get("precision") || params.get("measure");
  if (
    measure === "exact" ||
    measure === "precise" ||
    measure === "teaspoons" ||
    measure === "simple" ||
    measure === "rounded" ||
    measure === "tablespoons"
  ) {
    applyPrecision(measure, true);
  }
  if (params.get("brand") === "kingArthur") {
    brand = "kingArthur";
    selected(brandButtons, "data-brand", brand);
  }

  updatePresetLabels();
  render();
})();
