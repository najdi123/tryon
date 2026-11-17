import assert from "node:assert/strict";
import { test } from "node:test";
import { compensatedHex, judge } from "./judge";
import { deltaE, hexToLab, labToHex, rgbToLab } from "./lab";

const black = hexToLab("#1a1614");
const brown = hexToLab("#54392a");

test("Lab matches known values and survives a round trip", () => {
  const white = rgbToLab(255, 255, 255);
  assert.ok(Math.abs(white[0] - 100) < 0.01 && Math.abs(white[1]) < 0.01 && Math.abs(white[2]) < 0.01);
  const red = rgbToLab(255, 0, 0);
  assert.ok(Math.abs(red[0] - 53.24) < 0.1 && Math.abs(red[1] - 80.09) < 0.2 && Math.abs(red[2] - 67.2) < 0.2);
  for (const hex of ["#bba082", "#3f2c22", "#9b2f2f", "#a09689", "#000000", "#ffffff"]) assert.equal(labToHex(hexToLab(hex)), hex);
});
test("a preview within the tolerance is shown as it came (the tests' Lite results on gold, brown, ash)", () => {
  assert.equal(judge(hexToLab("#c4a486"), "#bba082", black).kind, "accept");
  assert.equal(judge(hexToLab("#41312a"), "#3f2c22", brown).kind, "accept");
  assert.equal(judge(hexToLab("#9e8f81"), "#a09689", brown).kind, "accept");
});
test("a preview that is the right colour but too dark is corrected, not paid for twice (the tests' red)", () => {
  const v = judge(hexToLab("#602822"), "#9b2f2f", brown);
  assert.equal(v.kind, "nudge");
  assert.ok(v.kind === "nudge" && v.scaleL > 1 && v.scaleL <= 1.18); // lighter, but only a little
});
test("a preview far from the shade asks for a new picture, compensated towards the shade", () => {
  const v = judge(hexToLab("#2e1514"), "#9b2f2f", black); // the tests' burgundy on black hair
  assert.equal(v.kind, "retry");
  assert.ok(v.kind === "retry" && v.compensate[0] > 0); // ask for lighter
  const asked = v.kind === "retry" ? compensatedHex("#9b2f2f", v.compensate) : "";
  assert.ok(hexToLab(asked)[0] > hexToLab("#9b2f2f")[0]);
});
test("hair that did not change is a retry, never shown as a result", () => {
  const v = judge(hexToLab("#1c1715"), "#bba082", black);
  assert.equal(v.kind === "retry" && v.reason, "unchanged");
});
test("a shade close to the customer's own hair is not mistaken for 'did not change'", () => {
  assert.equal(judge(hexToLab("#56392b"), "#54392a", brown).kind, "accept");
});
test("the correction is always small, however far the colour is inside the nudge range", () => {
  const v = judge(hexToLab("#32291f"), "#6e5c49", black); // the lightness would need doubling
  assert.ok(v.kind === "nudge" && v.scaleL === 1.18 && Math.abs(v.da) <= 7 && Math.abs(v.db) <= 7);
  const w = judge(hexToLab("#c9b08a"), "#a09689", brown); // too warm and too light for an ash
  assert.ok(w.kind === "nudge" && w.scaleL >= 0.88 && w.scaleL < 1 && Math.abs(w.db) <= 7);
});
test("a retry can never ask for a colour far from the shade", () => {
  const asked = compensatedHex("#bba082", [90, -90, 90]);
  assert.ok(deltaE(hexToLab(asked), hexToLab("#bba082")) <= Math.hypot(25, 25, 25) + 1);
});
